import { ScryfallQueryError } from './error.js';

/**
 * Normalize a Scryfall mana cost string into brace symbols.
 * `2WW` → `['{2}','{W}','{W}']`; `{2/G}` stays as one symbol.
 */
export const normalizeManaSymbols = (raw: string): string[] => {
  const input = raw.trim();
  if (!input) {
    throw new ScryfallQueryError('Empty mana value');
  }

  const symbols: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === '{') {
      const end = input.indexOf('}', i);
      if (end < 0) {
        throw new ScryfallQueryError(`Unclosed mana brace in “${raw}”`);
      }
      symbols.push(input.slice(i, end + 1).toUpperCase());
      i = end + 1;
      continue;
    }

    const ch = input[i]!;
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /\d/.test(input[j]!)) j += 1;
      symbols.push(`{${input.slice(i, j)}}`);
      i = j;
      continue;
    }

    if (/[wubrgcxst]/i.test(ch)) {
      symbols.push(`{${ch.toUpperCase()}}`);
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    throw new ScryfallQueryError(`Invalid mana symbol in “${raw}”`);
  }

  return symbols;
};

/** True when a normalized symbol list contains a hybrid pip like `{W/U}` or `{2/G}`. */
export const manaHasHybrid = (manaCost: string | null | undefined): boolean => {
  if (!manaCost) return false;
  return /\{[^}/]+\/[^}]+\}/.test(manaCost);
};

/** True when a mana cost contains a Phyrexian pip like `{W/P}` or `{P}`. */
export const manaHasPhyrexian = (manaCost: string | null | undefined): boolean => {
  if (!manaCost) return false;
  return /\{[^}]*P\}/i.test(manaCost);
};
