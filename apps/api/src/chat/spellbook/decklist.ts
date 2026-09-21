import type { DeckDetail } from 'schemas/decks';
import type { SpellbookDecklist } from './types';

export const toSpellbookDecklist = (detail: DeckDetail): SpellbookDecklist => {
  const commanderPrintingId = detail.deck.commanderPrintingId;
  const commanders: SpellbookDecklist['commanders'] = [];
  const main: SpellbookDecklist['main'] = [];
  for (const card of detail.cards) {
    if (card.sideboard) continue;
    const entry = { card: card.name, quantity: card.quantity };
    if (commanderPrintingId && card.printingId === commanderPrintingId) {
      commanders.push(entry);
      continue;
    }
    main.push(entry);
  }
  return { commanders, main };
};
