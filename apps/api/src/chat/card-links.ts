export type LinkableCard = { id: string; name: string };

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const cardMarkdownLink = (): RegExp => new RegExp(`\\[([^\\]]+)\\]\\(/cards/(${UUID})/?\\)`, 'g');

const hasIdName = (row: unknown): row is { id: string; name: string } =>
  Boolean(
    row &&
    typeof row === 'object' &&
    typeof (row as { id?: unknown }).id === 'string' &&
    typeof (row as { name?: unknown }).name === 'string',
  );

const hasCardIdName = (row: unknown): row is { cardId: string; name: string } =>
  Boolean(
    row &&
    typeof row === 'object' &&
    typeof (row as { cardId?: unknown }).cardId === 'string' &&
    typeof (row as { name?: unknown }).name === 'string',
  );

const addLinkable = (into: LinkableCard[], id: string, name: string): void => {
  if (!id || !name.trim()) return;
  const nameKey = name.toLowerCase();
  const indexes = [
    ...new Set(
      into
        .map((card, index) => (card.id === id || card.name.toLowerCase() === nameKey ? index : -1))
        .filter((index) => index >= 0),
    ),
  ].sort((a, b) => b - a);
  for (const index of indexes) into.splice(index, 1);
  into.push({ id, name });
};

/** Catalog names this conversation may link in prose. Does not feed presentRecommendations. */
export const collectLinkableCards = (
  toolName: string,
  data: unknown,
  into: LinkableCard[],
): void => {
  if (!data || typeof data !== 'object') return;
  if (toolName === 'searchCards' && 'cards' in data) {
    for (const card of (data as { cards?: unknown[] }).cards ?? []) {
      if (hasIdName(card)) addLinkable(into, card.id, card.name);
    }
  }
  if (toolName === 'getCard' && hasIdName(data)) {
    addLinkable(into, data.id, data.name);
  }
  if (toolName === 'lookupCombos') {
    for (const card of catalogCardsFromLookupCombos(data)) {
      addLinkable(into, card.id, card.name);
    }
  }
  if (toolName !== 'getDeck') return;
  const deck = data as { commander?: unknown; lines?: unknown[] };
  if (hasCardIdName(deck.commander)) addLinkable(into, deck.commander.cardId, deck.commander.name);
  for (const line of deck.lines ?? []) {
    if (hasCardIdName(line)) addLinkable(into, line.cardId, line.name);
  }
};

export const collectLinkableFromToolMessage = (
  toolName: string | null,
  parts: readonly { type: string; text?: string }[],
  into: LinkableCard[],
): void => {
  if (!toolName) return;
  const text = parts.find((part) => part.type === 'text')?.text;
  if (!text) return;
  const data = dataFromToolPayload(text);
  if (data === undefined) return;
  collectLinkableCards(toolName, data, into);
};

const hasCatalogIdName = (row: unknown): row is { catalogId: string; name: string } =>
  Boolean(
    row &&
    typeof row === 'object' &&
    typeof (row as { catalogId?: unknown }).catalogId === 'string' &&
    typeof (row as { name?: unknown }).name === 'string',
  );

export const catalogCardsFromLookupCombos = (data: unknown): LinkableCard[] => {
  if (!data || typeof data !== 'object') return [];
  const out: LinkableCard[] = [];
  const row = data as {
    included?: unknown[];
    almostIncluded?: unknown[];
    variants?: unknown[];
  };
  const visit = (combos: unknown[] | undefined) => {
    for (const combo of combos ?? []) {
      if (!combo || typeof combo !== 'object') continue;
      const entry = combo as { uses?: unknown[]; missing?: unknown[] };
      for (const card of [...(entry.uses ?? []), ...(entry.missing ?? [])]) {
        if (hasCatalogIdName(card)) out.push({ id: card.catalogId, name: card.name });
      }
    }
  };
  visit(row.included);
  visit(row.almostIncluded);
  visit(row.variants);
  return out;
};

const dataFromToolPayload = (text: string): unknown => {
  try {
    const envelope: unknown = JSON.parse(text);
    if (!envelope || typeof envelope !== 'object' || !('result' in envelope)) return undefined;
    const result = (envelope as { result?: unknown }).result;
    if (!result || typeof result !== 'object') return undefined;
    const row = result as { ok?: unknown; data?: unknown };
    if (row.ok !== true) return undefined;
    return row.data;
  } catch {
    return undefined;
  }
};

export const rewriteCardLinks = (
  text: string,
  cards: readonly LinkableCard[],
  onDrop?: (cardId: string) => void,
): string => {
  const ids = new Set(cards.map((card) => card.id.toLowerCase()));
  return allowlistMarkdownCardLinks(text, ids, onDrop);
};

const allowlistMarkdownCardLinks = (
  text: string,
  ids: ReadonlySet<string>,
  onDrop?: (cardId: string) => void,
): string =>
  text.replace(cardMarkdownLink(), (_full, label: string, id: string) => {
    const normalized = id.toLowerCase();
    if (ids.has(normalized)) return `[${label}](/cards/${normalized})`;
    onDrop?.(id);
    return label;
  });
