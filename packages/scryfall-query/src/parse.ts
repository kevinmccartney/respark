import type { Ast, ClauseValue, CompareOp, Field, ManaValue } from './ast.js';
import { parseColorValue } from './colors.js';
import { ScryfallQueryError } from './error.js';
import {
  FIELD_ALIASES,
  resolveField,
  SUPPORTED_HAS_FLAGS,
  SUPPORTED_IS_FLAGS,
  SUPPORTED_NEW_FLAGS,
  UNSUPPORTED_FIELD_ALIASES,
} from './fields.js';
import { normalizeManaSymbols } from './mana.js';
import { isRarityName, parseRarityName } from './rarity.js';

type Token =
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'or' }
  | { kind: 'not' }
  | { kind: 'atom'; text: string };

/**
 * Parse a Scryfall-syntax query into an AST.
 * Supports AND (whitespace), OR, parentheses, leading `-`, and the six in-scope sections.
 */
export const parseScryfallQuery = (input: string): Ast => {
  const source = input.trim();
  if (!source) {
    throw new ScryfallQueryError('Empty Scryfall query');
  }
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const ast = parser.parseOr();
  if (!parser.done()) {
    throw new ScryfallQueryError(`Unexpected token near “${parser.peekText()}”`);
  }
  return simplify(ast);
};

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  const skipWs = () => {
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
  };

  while (i < source.length) {
    skipWs();
    if (i >= source.length) break;

    const ch = source[i]!;
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }

    // Unary not: `-` before a field / paren / quoted name (after whitespace).
    if (ch === '-') {
      const next = source[i + 1];
      if (next && (next === '(' || next === '"' || /[A-Za-z]/.test(next))) {
        tokens.push({ kind: 'not' });
        i += 1;
        continue;
      }
    }

    const start = i;
    // Read an atom until whitespace / paren at brace/quote depth 0
    let depthBrace = 0;
    let inQuote = false;
    while (i < source.length) {
      const c = source[i]!;
      if (inQuote) {
        if (c === '\\' && i + 1 < source.length) {
          i += 2;
          continue;
        }
        if (c === '"') {
          inQuote = false;
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (c === '"') {
        inQuote = true;
        i += 1;
        continue;
      }
      if (c === '{') {
        depthBrace += 1;
        i += 1;
        continue;
      }
      if (c === '}' && depthBrace > 0) {
        depthBrace -= 1;
        i += 1;
        continue;
      }
      if (depthBrace === 0 && (/\s/.test(c) || c === '(' || c === ')')) break;
      i += 1;
    }

    const text = source.slice(start, i);
    if (!text) {
      throw new ScryfallQueryError(`Unexpected character “${ch}”`);
    }
    if (/^or$/i.test(text)) {
      tokens.push({ kind: 'or' });
    } else {
      tokens.push({ kind: 'atom', text });
    }
  }

  return tokens;
};

class Parser {
  private index = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  done(): boolean {
    return this.index >= this.tokens.length;
  }

  peekText(): string {
    const t = this.tokens[this.index];
    if (!t) return '';
    if (t.kind === 'atom') return t.text;
    return t.kind;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token {
    const t = this.tokens[this.index];
    if (!t) throw new ScryfallQueryError('Unexpected end of query');
    this.index += 1;
    return t;
  }

  parseOr(): Ast {
    const parts: Ast[] = [this.parseAnd()];
    while (this.peek()?.kind === 'or') {
      this.take();
      parts.push(this.parseAnd());
    }
    return parts.length === 1 ? parts[0]! : { type: 'or', children: parts };
  }

  parseAnd(): Ast {
    const parts: Ast[] = [this.parseUnary()];
    while (true) {
      const next = this.peek();
      if (!next || next.kind === 'or' || next.kind === 'rparen') break;
      parts.push(this.parseUnary());
    }
    return parts.length === 1 ? parts[0]! : { type: 'and', children: parts };
  }

  parseUnary(): Ast {
    if (this.peek()?.kind === 'not') {
      this.take();
      return { type: 'not', child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary(): Ast {
    const tok = this.take();
    if (tok.kind === 'lparen') {
      const inner = this.parseOr();
      const close = this.take();
      if (close.kind !== 'rparen') {
        throw new ScryfallQueryError('Expected closing “)”');
      }
      return inner;
    }
    if (tok.kind !== 'atom') {
      throw new ScryfallQueryError(`Unexpected token “${tok.kind}”`);
    }
    return parseAtom(tok.text);
  }
}

const parseAtom = (text: string): Ast => {
  const clause = tryParseClause(text);
  if (clause) return clause;
  // Bare name term (unquoted word or quoted phrase without a field)
  const name = unquote(text);
  if (!name) throw new ScryfallQueryError('Empty name term');
  return { type: 'name', text: name };
};

const tryParseClause = (text: string): Ast | null => {
  // Match field + operator at the start: `mv<=3`, `t:creature`, `color>=uw`
  const match = text.match(/^([a-zA-Z]+)(!=|<=|>=|:|=|<|>)([\s\S]*)$/);
  if (!match) return null;

  const [, fieldRaw, opRaw, valueRaw] = match;
  if (!fieldRaw || !opRaw || valueRaw === undefined) return null;

  const key = fieldRaw.toLowerCase();

  // If it isn't a known field (or unsupported keyword), treat as a bare name —
  // e.g. names containing colons are rare; Scryfall would still parse as clause.
  // We only claim clause form for registered aliases.
  if (!FIELD_ALIASES[key] && !UNSUPPORTED_FIELD_ALIASES[key]) {
    return null;
  }

  const field = resolveField(fieldRaw);
  const op = opRaw as CompareOp;
  const value = parseClauseValue(field, op, valueRaw);
  return { type: 'clause', field, op, value };
};

const parseClauseValue = (field: Field, op: CompareOp, raw: string): ClauseValue => {
  const value = unquote(raw.trim());
  if (value === '' && field !== 'oracle' && field !== 'fulloracle') {
    throw new ScryfallQueryError(`Missing value for ${field}`);
  }

  switch (field) {
    case 'color':
    case 'identity':
      return { kind: 'colors', value: parseColorValue(value) };
    case 'type':
    case 'oracle':
    case 'fulloracle':
    case 'keyword':
    case 'set':
    case 'block':
    case 'group':
    case 'setType':
      return { kind: 'text', text: value };
    case 'format': {
      if (op !== ':' && op !== '=' && op !== '!=') {
        throw new ScryfallQueryError(`format does not support operator “${op}”`);
      }
      const format = value.toLowerCase();
      if (!/^[a-z][a-z0-9]*$/.test(format)) {
        throw new ScryfallQueryError(`Invalid format “${value}”`);
      }
      return { kind: 'text', text: format };
    }
    case 'mana':
    case 'devotion':
    case 'produces':
      return { kind: 'mana', value: parseManaFieldValue(field, value) };
    case 'manavalue':
      return { kind: 'mana', value: parseManaValueField(value) };
    case 'rarity':
      return { kind: 'rarity', rarity: parseRarityName(value) };
    case 'collectorNumber': {
      if (op === ':' || op === '=' || op === '!=') {
        // Exact collector number may be non-numeric (`123a`)
        if (!/^-?\d+(\.\d+)?$/.test(value)) return { kind: 'text', text: value };
      }
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new ScryfallQueryError(`Invalid collector number “${value}”`);
      }
      return { kind: 'number', n };
    }
    case 'in':
      // Rarity or set code / set type — leave as text; SQL compiler disambiguates.
      if (isRarityName(value)) return { kind: 'rarity', rarity: parseRarityName(value) };
      return { kind: 'text', text: value.toLowerCase() };
    case 'is': {
      const flag = value.toLowerCase();
      if (!SUPPORTED_IS_FLAGS.has(flag)) {
        throw new ScryfallQueryError(`Unsupported is:${flag}`, 'unsupported');
      }
      return { kind: 'flag', flag };
    }
    case 'has': {
      const flag = value.toLowerCase();
      if (!SUPPORTED_HAS_FLAGS.has(flag)) {
        throw new ScryfallQueryError(`Unsupported has:${flag}`, 'unsupported');
      }
      return { kind: 'flag', flag };
    }
    case 'new': {
      const flag = value.toLowerCase();
      if (!SUPPORTED_NEW_FLAGS.has(flag)) {
        throw new ScryfallQueryError(`Unsupported new:${flag}`, 'unsupported');
      }
      return { kind: 'flag', flag };
    }
    default: {
      const _exhaustive: never = field;
      throw new ScryfallQueryError(`Unhandled field ${_exhaustive}`);
    }
  }
};

const parseManaFieldValue = (field: Field, value: string): ManaValue => {
  // produces: often uses color letters without braces (`wu`)
  if (field === 'produces') {
    try {
      return { kind: 'symbols', symbols: normalizeManaSymbols(value) };
    } catch {
      // Fall back: treat as color pips expanded to symbols
      const colors = parseColorValue(value);
      if (colors.kind === 'pips') {
        return { kind: 'symbols', symbols: colors.pips.map((p) => `{${p}}`) };
      }
      throw new ScryfallQueryError(`Invalid produces value “${value}”`);
    }
  }
  return { kind: 'symbols', symbols: normalizeManaSymbols(value) };
};

const parseManaValueField = (value: string): ManaValue => {
  const v = value.trim().toLowerCase();
  if (v === 'even') return { kind: 'parity', parity: 'even' };
  if (v === 'odd') return { kind: 'parity', parity: 'odd' };
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new ScryfallQueryError(`Invalid mana value “${value}”`);
  }
  return { kind: 'number', n };
};

const unquote = (raw: string): string => {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return raw;
};

const simplify = (ast: Ast): Ast => {
  if (ast.type === 'and' || ast.type === 'or') {
    const children = ast.children.map(simplify);
    if (children.length === 1) return children[0]!;
    return { type: ast.type, children };
  }
  if (ast.type === 'not') {
    return { type: 'not', child: simplify(ast.child) };
  }
  return ast;
};
