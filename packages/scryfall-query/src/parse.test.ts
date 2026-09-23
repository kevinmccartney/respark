import { describe, expect, it } from 'vitest';

import { parseColorValue } from './colors.js';
import { normalizeManaSymbols } from './mana.js';
import { parseScryfallQuery } from './parse.js';
import { parseRarityName, RARITY_RANK } from './rarity.js';

describe('normalizeManaSymbols', () => {
  it('expands shorthand and keeps braced hybrids', () => {
    expect(normalizeManaSymbols('2WW')).toEqual(['{2}', '{W}', '{W}']);
    expect(normalizeManaSymbols('{G}{U}')).toEqual(['{G}', '{U}']);
    expect(normalizeManaSymbols('{2/G}')).toEqual(['{2/G}']);
    expect(normalizeManaSymbols('{R/P}')).toEqual(['{R/P}']);
  });
});

describe('parseColorValue', () => {
  it('parses letters, names, nicknames, colorless, multicolor, count', () => {
    expect(parseColorValue('rg')).toEqual({ kind: 'pips', pips: ['R', 'G'] });
    expect(parseColorValue('blue')).toEqual({ kind: 'pips', pips: ['U'] });
    expect(parseColorValue('esper')).toEqual({ kind: 'pips', pips: ['W', 'U', 'B'] });
    expect(parseColorValue('azorius')).toEqual({ kind: 'pips', pips: ['W', 'U'] });
    expect(parseColorValue('c')).toEqual({ kind: 'colorless' });
    expect(parseColorValue('multicolor')).toEqual({ kind: 'multicolor' });
    expect(parseColorValue('2')).toEqual({ kind: 'count', count: 2 });
  });
});

describe('parseRarityName', () => {
  it('accepts names and single-letter aliases', () => {
    expect(parseRarityName('rare')).toBe('rare');
    expect(parseRarityName('r')).toBe('rare');
    expect(RARITY_RANK.mythic).toBeGreaterThan(RARITY_RANK.rare);
  });
});

describe('parseScryfallQuery', () => {
  it('parses AND juxtaposition and OR / parens / negation', () => {
    const ast = parseScryfallQuery('t:creature c:g OR t:instant');
    expect(ast).toEqual({
      type: 'or',
      children: [
        {
          type: 'and',
          children: [
            { type: 'clause', field: 'type', op: ':', value: { kind: 'text', text: 'creature' } },
            {
              type: 'clause',
              field: 'color',
              op: ':',
              value: { kind: 'colors', value: { kind: 'pips', pips: ['G'] } },
            },
          ],
        },
        { type: 'clause', field: 'type', op: ':', value: { kind: 'text', text: 'instant' } },
      ],
    });

    expect(parseScryfallQuery('-t:creature')).toEqual({
      type: 'not',
      child: { type: 'clause', field: 'type', op: ':', value: { kind: 'text', text: 'creature' } },
    });

    expect(parseScryfallQuery('t:goblin -t:creature')).toEqual({
      type: 'and',
      children: [
        { type: 'clause', field: 'type', op: ':', value: { kind: 'text', text: 'goblin' } },
        {
          type: 'not',
          child: {
            type: 'clause',
            field: 'type',
            op: ':',
            value: { kind: 'text', text: 'creature' },
          },
        },
      ],
    });

    expect(parseScryfallQuery('(c:r OR c:g) t:instant')).toMatchObject({
      type: 'and',
      children: [{ type: 'or' }, { type: 'clause', field: 'type' }],
    });
  });

  it('parses identity nicknames and comparisons', () => {
    expect(parseScryfallQuery('id<=esper')).toEqual({
      type: 'clause',
      field: 'identity',
      op: '<=',
      value: { kind: 'colors', value: { kind: 'pips', pips: ['W', 'U', 'B'] } },
    });
    expect(parseScryfallQuery('c=2')).toEqual({
      type: 'clause',
      field: 'color',
      op: '=',
      value: { kind: 'colors', value: { kind: 'count', count: 2 } },
    });
  });

  it('parses oracle quotes, tilde, keywords, mana, mv', () => {
    expect(parseScryfallQuery('o:"~ enters tapped"')).toEqual({
      type: 'clause',
      field: 'oracle',
      op: ':',
      value: { kind: 'text', text: '~ enters tapped' },
    });
    expect(parseScryfallQuery('kw:flying')).toEqual({
      type: 'clause',
      field: 'keyword',
      op: ':',
      value: { kind: 'text', text: 'flying' },
    });
    expect(parseScryfallQuery('m:2WW')).toEqual({
      type: 'clause',
      field: 'mana',
      op: ':',
      value: { kind: 'mana', value: { kind: 'symbols', symbols: ['{2}', '{W}', '{W}'] } },
    });
    expect(parseScryfallQuery('mv<=3')).toEqual({
      type: 'clause',
      field: 'manavalue',
      op: '<=',
      value: { kind: 'mana', value: { kind: 'number', n: 3 } },
    });
    expect(parseScryfallQuery('manavalue:even')).toEqual({
      type: 'clause',
      field: 'manavalue',
      op: ':',
      value: { kind: 'mana', value: { kind: 'parity', parity: 'even' } },
    });
  });

  it('parses rarity, sets, in:, is:, has:, new:', () => {
    expect(parseScryfallQuery('r>=r')).toEqual({
      type: 'clause',
      field: 'rarity',
      op: '>=',
      value: { kind: 'rarity', rarity: 'rare' },
    });
    expect(parseScryfallQuery('e:war')).toEqual({
      type: 'clause',
      field: 'set',
      op: ':',
      value: { kind: 'text', text: 'war' },
    });
    expect(parseScryfallQuery('in:rare')).toEqual({
      type: 'clause',
      field: 'in',
      op: ':',
      value: { kind: 'rarity', rarity: 'rare' },
    });
    expect(parseScryfallQuery('in:lea')).toEqual({
      type: 'clause',
      field: 'in',
      op: ':',
      value: { kind: 'text', text: 'lea' },
    });
    expect(parseScryfallQuery('is:booster')).toEqual({
      type: 'clause',
      field: 'is',
      op: ':',
      value: { kind: 'flag', flag: 'booster' },
    });
    expect(parseScryfallQuery('has:indicator')).toEqual({
      type: 'clause',
      field: 'has',
      op: ':',
      value: { kind: 'flag', flag: 'indicator' },
    });
    expect(parseScryfallQuery('new:rarity')).toEqual({
      type: 'clause',
      field: 'new',
      op: ':',
      value: { kind: 'flag', flag: 'rarity' },
    });
    expect(parseScryfallQuery('cn>50')).toEqual({
      type: 'clause',
      field: 'collectorNumber',
      op: '>',
      value: { kind: 'number', n: 50 },
    });
    expect(parseScryfallQuery('st:commander')).toEqual({
      type: 'clause',
      field: 'setType',
      op: ':',
      value: { kind: 'text', text: 'commander' },
    });
    expect(parseScryfallQuery('b:wwk')).toEqual({
      type: 'clause',
      field: 'block',
      op: ':',
      value: { kind: 'text', text: 'wwk' },
    });
  });

  it('parses bare names', () => {
    expect(parseScryfallQuery('lightning')).toEqual({ type: 'name', text: 'lightning' });
    expect(parseScryfallQuery('"doom blade"')).toEqual({ type: 'name', text: 'doom blade' });
  });

  it('parses format legality', () => {
    expect(parseScryfallQuery('f:commander')).toEqual({
      type: 'clause',
      field: 'format',
      op: ':',
      value: { kind: 'text', text: 'commander' },
    });
    expect(parseScryfallQuery('format:modern')).toEqual({
      type: 'clause',
      field: 'format',
      op: ':',
      value: { kind: 'text', text: 'modern' },
    });
    expect(parseScryfallQuery('-f:standard')).toEqual({
      type: 'not',
      child: {
        type: 'clause',
        field: 'format',
        op: ':',
        value: { kind: 'text', text: 'standard' },
      },
    });
    expect(() => parseScryfallQuery('f>commander')).toThrow(/does not support operator/);
  });

  it('rejects unsupported and unknown keywords with clear errors', () => {
    expect(() => parseScryfallQuery('banned:commander')).toThrow(/Unsupported Scryfall keyword/);
    expect(() => parseScryfallQuery('pow>1')).toThrow(/Unsupported Scryfall keyword/);
    expect(() => parseScryfallQuery('usd>1')).toThrow(/Unsupported Scryfall keyword/);
    expect(() => parseScryfallQuery('cube:vintage')).toThrow(/Unsupported/);
    expect(() => parseScryfallQuery('is:vanilla')).toThrow(/Unsupported is:vanilla/);
  });

  it('parses a realistic combined query', () => {
    const ast = parseScryfallQuery('t:creature c:g mv<=3');
    expect(ast.type).toBe('and');
    if (ast.type !== 'and') return;
    expect(ast.children).toHaveLength(3);
  });
});
