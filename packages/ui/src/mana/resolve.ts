import { MANA_SYMBOLS, type ManaSymbol } from './symbols.js';

const HYBRID_TOKEN_RE = /^[0-9A-Z]+(?:\/[0-9A-Z]+)+$/;

export const resolveManaSymbol = (inner: string): ManaSymbol | null => {
  const known = MANA_SYMBOLS[inner];
  if (known) return known;
  if (HYBRID_TOKEN_RE.test(inner)) {
    return { svgCode: inner.replaceAll('/', ''), english: inner };
  }
  return null;
};

export const manaSymbolSvgUrl = (svgCode: string): string =>
  `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(svgCode)}.svg`;
