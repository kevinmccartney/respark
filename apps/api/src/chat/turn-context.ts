import type { ChatView } from 'schemas/chat';
import { SYSTEM_PROMPT } from './prompts';

export const formatTurnContext = (opts: {
  stickyDeckId: string | null;
  stickyCardId: string | null;
  view?: ChatView;
}): string => {
  const viewLines = formatView(opts.view);
  return `${SYSTEM_PROMPT}

Sticky discussion context (attached by the player or getDeck / getCard; survives navigation):
- deckId: ${opts.stickyDeckId ?? 'none'}
- cardId: ${opts.stickyCardId ?? 'none'}

Current app view (the open page this turn; not sticky, does not attach or clear discussion context):
${viewLines}`;
};

const formatView = (view?: ChatView): string => {
  if (!view) return '- area: unknown';
  const lines = [`- area: ${view.area}`];
  if (view.deckId) lines.push(`- viewingDeckId: ${view.deckId}`);
  if (view.cardId) lines.push(`- viewingCardId: ${view.cardId}`);
  if (view.q) lines.push(`- searchQ: ${view.q}`);
  return lines.join('\n');
};
