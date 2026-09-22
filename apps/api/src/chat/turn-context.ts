import type { ChatView } from '@respark/schemas/chat';

import type { GoodstuffPromptLine } from '../recommendations/recommendations.service';

import type { LinkableCard } from './card-links';
import { CHAT_GOODSTUFF_PROMPT_CAP, CHAT_GROUNDED_CARD_PROMPT_CAP } from './chat.constants';
import { SYSTEM_PROMPT } from './prompts';

export const formatTurnContext = (opts: {
  stickyDeckId: string | null;
  stickyCardId: string | null;
  view?: ChatView;
  groundedCards?: readonly LinkableCard[];
  goodstuffs?: readonly GoodstuffPromptLine[];
}): string => {
  const viewLines = formatView(opts.view);
  const groundedLines = formatGroundedCards(opts.groundedCards ?? []);
  const goodstuffLines = formatGoodstuffs(opts.goodstuffs ?? []);
  return `${SYSTEM_PROMPT}

Sticky discussion context (attached by the player or getDeck / getCard; survives navigation):
- deckId: ${opts.stickyDeckId ?? 'none'}
- cardId: ${opts.stickyCardId ?? 'none'}

Current app view (the open page this turn; not sticky, does not attach or clear discussion context):
${viewLines}

Catalog-grounded cards already retrieved in this conversation (name → id). Only mention these or new tool results. If you need another card, call searchCards or getCard.
${groundedLines}

Admin goodstuff list (generically strong cards, tagged). Prefer other cards unless the player asked for that class or the attached deck already plays that pattern. Tool-result goodstuff flags are the source of truth.
${goodstuffLines}`;
};

export const formatGoodstuffs = (
  rows: readonly GoodstuffPromptLine[],
  cap = CHAT_GOODSTUFF_PROMPT_CAP,
): string => {
  if (rows.length === 0) return '- none configured';
  const shown = rows.slice(0, cap);
  const omitted = Math.max(0, rows.length - shown.length);
  const lines = shown.map((row) => `- ${row.name} (${row.tags.join(', ')})`);
  if (omitted > 0) lines.push(`- (${omitted} more omitted)`);
  return lines.join('\n');
};

export const formatGroundedCards = (
  cards: readonly LinkableCard[],
  cap = CHAT_GROUNDED_CARD_PROMPT_CAP,
): string => {
  if (cards.length === 0) {
    return '- none yet; call searchCards, getCard, or getDeck before naming a card';
  }
  const omitted = Math.max(0, cards.length - cap);
  const shown = omitted > 0 ? cards.slice(-cap) : cards;
  const lines = shown.map((card) => `- ${card.name}: ${card.id}`);
  if (omitted > 0) {
    lines.push(`- (${omitted} more omitted; they still link in replies)`);
  }
  return lines.join('\n');
};

const formatView = (view?: ChatView): string => {
  if (!view) return '- area: unknown';
  const lines = [`- area: ${view.area}`];
  if (view.deckId) lines.push(`- viewingDeckId: ${view.deckId}`);
  if (view.cardId) lines.push(`- viewingCardId: ${view.cardId}`);
  if (view.scryfall) lines.push(`- searchScryfall: ${view.scryfall}`);
  return lines.join('\n');
};
