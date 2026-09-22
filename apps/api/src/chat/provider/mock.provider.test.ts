import { describe, expect, it } from 'vitest';

import { SEARCH_CARDS_TOOL_DEFAULT_LIMIT } from '@respark/schemas/chat';

import { formatTurnContext } from '../turn-context';

import type { ProviderEvent, ProviderMessage, ProviderToolDef } from './chat-provider';
import {
  catalogSearchInput,
  isCapabilityAsk,
  MockChatProvider,
  parseMockTurnContext,
  refersToNamedDeck,
  refersToOpenDeck,
} from './mock.provider';

const viewingDeckId = 'a1dd0f36-b5fd-4ef5-9ab1-1270b524ac70';
const hakbalId = '00000000-0000-4000-8000-000000000001';

const tools: ProviderToolDef[] = [
  { name: 'listDecks', description: '', inputSchema: {} },
  { name: 'getDeck', description: '', inputSchema: {} },
  { name: 'searchCards', description: '', inputSchema: {} },
  { name: 'presentRecommendations', description: '', inputSchema: {} },
];

const viewingSystem = formatTurnContext({
  stickyDeckId: null,
  stickyCardId: null,
  view: { area: 'deck', deckId: viewingDeckId },
});

const collect = async (messages: ProviderMessage[], system = ''): Promise<ProviderEvent[]> => {
  const events: ProviderEvent[] = [];
  for await (const event of new MockChatProvider().stream({
    system,
    messages,
    tools,
  })) {
    events.push(event);
  }
  return events;
};

const toolEnd = (events: ProviderEvent[]) => events.find((event) => event.type === 'tool-call-end');

describe('catalogSearchInput', () => {
  it('omits scryfall for conversational deck-add prompts', () => {
    expect(catalogSearchInput('What would be a good add to this deck?')).toEqual({
      limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT,
    });
  });

  it('keeps short queries and type filters as scryfall', () => {
    expect(catalogSearchInput('counterspell')).toEqual({
      scryfall: 'counterspell',
      limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT,
    });
    expect(catalogSearchInput('Suggest three creatures')).toEqual({
      limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT,
      scryfall: 't:creature',
    });
  });
});

describe('isCapabilityAsk', () => {
  it('detects identity questions', () => {
    expect(
      isCapabilityAsk('Who are you? What can you do? Do you know much about Magic the gathering?'),
    ).toBe(true);
    expect(isCapabilityAsk('What would be a good add to this deck?')).toBe(false);
  });
});

describe('parseMockTurnContext', () => {
  it('reads viewingDeckId from the turn system prompt', () => {
    expect(parseMockTurnContext(viewingSystem)).toEqual({ viewingDeckId });
    expect(refersToOpenDeck("Can you use the deck I'm looking at?")).toBe(true);
    expect(refersToNamedDeck('My Hakbal deck')).toBe(true);
  });
});

describe('MockChatProvider', () => {
  it('answers capability questions without searching', async () => {
    const events = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Who are you? What can you do?' }],
      },
    ]);
    expect(events.some((event) => event.type === 'tool-call')).toBe(false);
    const text = events.find((event) => event.type === 'text-delta');
    expect(text?.type === 'text-delta' ? text.delta : '').toMatch(/Respark's assistant/);
  });

  it('loads the open page deck when the player asks to use it', async () => {
    const events = await collect(
      [
        {
          role: 'user',
          content: [{ type: 'text', text: "Can you use the deck I'm looking at?" }],
        },
      ],
      viewingSystem,
    );
    expect(toolEnd(events)).toMatchObject({
      name: 'getDeck',
      input: { deckId: viewingDeckId },
    });
  });

  it('retries getDeck with viewingDeckId after no_deck_context', async () => {
    const events = await collect(
      [
        {
          role: 'user',
          content: [{ type: 'text', text: 'What would be a good add to this deck?' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'tool-use', id: 'mock-getDeck', name: 'getDeck', input: {} }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool-result',
              id: 'mock-getDeck',
              name: 'getDeck',
              result: {
                ok: false,
                code: 'no_deck_context',
                message: 'this conversation has no deck',
              },
            },
          ],
        },
      ],
      viewingSystem,
    );
    expect(toolEnd(events)).toMatchObject({
      name: 'getDeck',
      input: { deckId: viewingDeckId },
    });
  });

  it('lists decks when the player names a list and nothing is attached', async () => {
    const first = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'My Hakbal deck' }],
      },
    ]);
    expect(toolEnd(first)).toMatchObject({ name: 'listDecks', input: {} });

    const second = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'My Hakbal deck' }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool-result',
            id: 'mock-listDecks',
            name: 'listDecks',
            result: {
              ok: true,
              data: {
                decks: [
                  { id: hakbalId, name: 'Hakbal' },
                  { id: '00000000-0000-4000-8000-000000000099', name: 'Beseech the Mirror' },
                ],
              },
            },
          },
        ],
      },
    ]);
    expect(toolEnd(second)).toMatchObject({
      name: 'getDeck',
      input: { deckId: hakbalId },
    });
  });

  it('searches the catalog when no deck is needed', async () => {
    const events = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Suggest some cards' }],
      },
    ]);
    expect(toolEnd(events)).toMatchObject({
      name: 'searchCards',
      input: { limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT },
    });
  });

  it('starts a deck-add with getDeck, then searches without the user sentence as q', async () => {
    const first = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What would be a good add to this deck?' }],
      },
    ]);
    expect(toolEnd(first)).toMatchObject({ name: 'getDeck', input: {} });

    const second = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What would be a good add to this deck?' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'tool-use', id: 'mock-getDeck', name: 'getDeck', input: {} }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool-result',
            id: 'mock-getDeck',
            name: 'getDeck',
            result: { ok: true, data: { id: 'deck-1' } },
          },
        ],
      },
    ]);
    expect(toolEnd(second)).toMatchObject({
      name: 'searchCards',
      input: { limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT },
    });
  });

  it('presents search hits instead of claiming none', async () => {
    const events = await collect([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What would be a good add to this deck?' }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool-result',
            id: 'mock-searchCards',
            name: 'searchCards',
            result: {
              ok: true,
              data: { cards: [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }] },
            },
          },
        ],
      },
    ]);
    expect(toolEnd(events)).toMatchObject({
      name: 'presentRecommendations',
      input: { cardIds: ['card-1', 'card-2', 'card-3'] },
    });
  });
});
