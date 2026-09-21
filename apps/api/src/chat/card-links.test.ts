import { describe, expect, it, vi } from 'vitest';
import {
  collectLinkableCards,
  collectLinkableFromToolMessage,
  rewriteCardLinks,
  type LinkableCard,
} from './card-links';

const SOL = '00000000-0000-4000-8000-000000000001';
const RING = '00000000-0000-4000-8000-000000000002';
const FAKE = '00000000-0000-4000-8000-000000000099';
const BRAIDS = '00000000-0000-4000-8000-00000000000b';

const cards: LinkableCard[] = [
  { id: SOL, name: 'Sol Ring' },
  { id: RING, name: 'Ring' },
];

describe('rewriteCardLinks', () => {
  it('keeps markdown hrefs for linkable ids', () => {
    expect(rewriteCardLinks(`Try [Sol Ring](/cards/${SOL}) first.`, cards)).toBe(
      `Try [Sol Ring](/cards/${SOL}) first.`,
    );
  });

  it('unwraps ungrounded markdown hrefs', () => {
    const dropped: string[] = [];
    expect(
      rewriteCardLinks(`Skip [Bogus](/cards/${FAKE}/) please.`, cards, (id) => dropped.push(id)),
    ).toBe('Skip Bogus please.');
    expect(dropped).toEqual([FAKE]);
  });

  it('leaves plain catalog names unlinked', () => {
    expect(rewriteCardLinks('Sol Ring is a staple. Ring is too vague.', cards)).toBe(
      'Sol Ring is a staple. Ring is too vague.',
    );
  });

  it('leaves names inside code spans and non-card links unchanged', () => {
    expect(rewriteCardLinks(`Use \`Sol Ring\` or [docs](https://example.com).`, cards)).toBe(
      'Use `Sol Ring` or [docs](https://example.com).',
    );
  });

  it('ignores names that are not in the map', () => {
    expect(rewriteCardLinks('Lightning Bolt is cheap.', cards)).toBe('Lightning Bolt is cheap.');
  });

  it('does not match a shorter name inside a longer word', () => {
    expect(rewriteCardLinks('Forestry is a different card.', [{ id: RING, name: 'Forest' }])).toBe(
      'Forestry is a different card.',
    );
  });
});

describe('collectLinkableCards', () => {
  it('collects searchCards and getCard, including getDeck lines without mixing those into the array twice', () => {
    const into: LinkableCard[] = [];
    collectLinkableCards(
      'searchCards',
      {
        cards: [
          { id: SOL, name: 'Sol Ring' },
          { id: SOL, name: 'Sol Ring' },
        ],
      },
      into,
    );
    collectLinkableCards('getCard', { id: RING, name: 'Ring' }, into);
    collectLinkableCards(
      'getDeck',
      {
        commander: { cardId: BRAIDS, name: 'Braids, Conjurer Adept' },
        lines: [
          { cardId: BRAIDS, name: 'Braids, Conjurer Adept' },
          { cardId: SOL, name: 'Sol Ring' },
        ],
      },
      into,
    );
    expect(into).toEqual([
      { id: RING, name: 'Ring' },
      { id: BRAIDS, name: 'Braids, Conjurer Adept' },
      { id: SOL, name: 'Sol Ring' },
    ]);
  });

  it('collects lookupCombos catalog ids and skips unresolved names', () => {
    const into: LinkableCard[] = [];
    collectLinkableCards(
      'lookupCombos',
      {
        included: [
          {
            uses: [
              { name: 'Sol Ring', catalogId: SOL, inDeck: true },
              { name: 'Unknown', catalogId: null, inDeck: false },
            ],
            missing: [],
          },
        ],
      },
      into,
    );
    expect(into).toEqual([{ id: SOL, name: 'Sol Ring' }]);
  });

  it('ignores other tools', () => {
    const into: LinkableCard[] = [];
    collectLinkableCards('listDecks', { decks: [{ id: SOL, name: 'Braids' }] }, into);
    collectLinkableCards('presentRecommendations', { cardIds: [SOL] }, into);
    expect(into).toEqual([]);
  });
});

describe('collectLinkableFromToolMessage', () => {
  it('reads ok tool payloads in persist order', () => {
    const into: LinkableCard[] = [];
    collectLinkableFromToolMessage(
      'searchCards',
      [
        {
          type: 'text',
          text: JSON.stringify({
            args: {},
            result: { ok: true, data: { cards: [{ id: SOL, name: 'Sol Ring' }] } },
          }),
        },
      ],
      into,
    );
    collectLinkableFromToolMessage(
      'getDeck',
      [
        {
          type: 'text',
          text: JSON.stringify({
            args: {},
            result: {
              ok: false,
              code: 'not_found',
              message: 'nope',
            },
          }),
        },
      ],
      into,
    );
    expect(into).toEqual([{ id: SOL, name: 'Sol Ring' }]);
  });
});

describe('allowlistCardIds stays independent', () => {
  it('does not treat collectLinkableCards as the recommendation allowlist', async () => {
    const { allowlistCardIds } = await import('./allowlist');
    const into: LinkableCard[] = [];
    collectLinkableCards('getDeck', { lines: [{ cardId: SOL, name: 'Sol Ring' }] }, into);
    expect(into.map((card) => card.id)).toEqual([SOL]);
    const spy = vi.fn();
    expect(allowlistCardIds([SOL], new Set(), spy)).toEqual([]);
    expect(spy).toHaveBeenCalledWith(SOL);
  });
});
