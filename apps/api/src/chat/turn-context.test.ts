import { describe, expect, it } from 'vitest';
import { chatViewFromLocation } from 'schemas/chat';
import { formatTurnContext } from './turn-context';

const deckId = '00000000-0000-4000-8000-000000000001';
const cardId = '00000000-0000-4000-8000-000000000002';

describe('chatViewFromLocation', () => {
  it('maps signed-in routes', () => {
    expect(chatViewFromLocation('/home')).toEqual({ area: 'home' });
    expect(chatViewFromLocation('/search')).toEqual({ area: 'search' });
    expect(chatViewFromLocation('/search', '?q=counterspell')).toEqual({
      area: 'search',
      q: 'counterspell',
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
      view: { area: 'search', q: 'bolt' },
    });
    expect(text).toContain(`deckId: ${deckId}`);
    expect(text).toContain('cardId: none');
    expect(text).toContain('area: search');
    expect(text).toContain('searchQ: bolt');
    expect(text).toContain('not sticky');
  });
});
