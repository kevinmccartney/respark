export type ManaTextPart = { kind: 'text'; value: string } | { kind: 'symbol'; value: string };

const SYMBOL_RE = /\{([^}]+)\}/g;

export const tokenizeManaText = (text: string): ManaTextPart[] => {
  const parts: ManaTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SYMBOL_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    parts.push({ kind: 'symbol', value: match[1] ?? '' });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return parts;
};
