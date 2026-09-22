import { describe, expect, it } from 'vitest';

import { chatViewFromLocation } from '@respark/schemas/chat';

import { CHAT_GROUNDED_CARD_PROMPT_CAP } from './chat.constants';
import { formatGroundedCards, formatTurnContext } from './turn-context';

const deckId = '00000000-0000-4000-8000-000000000001';
const cardId = '00000000-0000-4000-8000-000000000002';

describe('chatViewFromLocation', () => {
  it('maps signed-in routes', () => {
    expect(chatViewFromLocation('/home')).toEqual({ area: 'home' });
    expect(chatViewFromLocation('/search')).toEqual({ area: 'search' });
    expect(chatViewFromLocation('/search', '?scryfall=t:creature+id:g')).toEqual({
      area: 'search',
      scryfall: 't:creature id:g',
    });
    expect(chatViewFromLocation('/decks/new')).toEqual({ area: 'new-deck' });
    expect(chatViewFromLocation(`/decks/${deckId}`)).toEqual({ area: 'deck', deckId });
    expect(chatViewFromLocation(`/cards/${cardId}`)).toEqual({ area: 'card', cardId });
    expect(chatViewFromLocation('/nope')).toEqual({ area: 'other' });
  });
});

describe('formatTurnContext', () => {
  it('keeps sticky ids distinct from the open page', () => {
    const text = formatTurnContext({
      stickyDeckId: deckId,
      stickyCardId: null,
      view: { area: 'search', scryfall: 't:instant counter' },
    });
    expect(text).toContain(`deckId: ${deckId}`);
    expect(text).toContain('cardId: none');
    expect(text).toContain('area: search');
    expect(text).toContain('searchScryfall: t:instant counter');
    expect(text).toContain('not sticky');
    expect(text).toContain('none yet');
    expect(text).toContain('none configured');
  });

  it('lists admin goodstuff in the system appendix', () => {
    const text = formatTurnContext({
      stickyDeckId: null,
      stickyCardId: null,
      goodstuffs: [{ name: 'Mystic Remora', tags: ['card_draw', 'value_engine', 'tax'] }],
    });
    expect(text).toContain('Mystic Remora (card_draw, value_engine, tax)');
  });

  it('includes grounded names in the system appendix', () => {
    const text = formatTurnContext({
      stickyDeckId: null,
      stickyCardId: null,
      groundedCards: [{ id: cardId, name: 'Sol Ring' }],
    });
    expect(text).toContain('Sol Ring:');
    expect(text).toContain(cardId);
    expect(text).toContain('Only mention these or new tool results');
  });

  it('lists grounded cards and notes when the prompt cap is exceeded', () => {
    const cards = Array.from({ length: CHAT_GROUNDED_CARD_PROMPT_CAP + 2 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      name: `Card ${i + 1}`,
    }));
    const listed = formatGroundedCards(cards);
    expect(listed).toContain('Card 3:');
    expect(listed).not.toContain('Card 1:');
    expect(listed).toContain('2 more omitted');
  });
});
