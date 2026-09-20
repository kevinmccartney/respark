import { describe, expect, it } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import type { CardSearchPage } from 'schemas/cards';
import type { ChatPart, ChatServerEvent } from 'schemas/chat';
import type { DeckCard, DeckDetail } from 'schemas/decks';
import type { CardsService } from '../cards/cards.service';
import type { DecksService } from '../decks/decks.service';
import { CHAT_MAX_TOOL_CALLS } from './chat.constants';
import { ChatOrchestrator } from './orchestrator';
import { ScriptedChatProvider } from './provider/scripted.provider';
import type { ChatService } from './chat.service';

const CARD_ID = '00000000-0000-4000-8000-000000000005';
const CONV_ID = '00000000-0000-4000-8000-0000000000bb';
const DECK_ID = '00000000-0000-4000-8000-0000000000de';
const DECK_CARD_ID = '00000000-0000-4000-8000-0000000000d1';
const DECK_PRINTING_ID = '00000000-0000-4000-8000-0000000000d2';

type LogLine = { level: string; obj: Record<string, unknown>; msg?: string };

const capturingLogger = (lines: LogLine[]): PinoLogger =>
  ({
    info: (obj: Record<string, unknown>, msg?: string) => lines.push({ level: 'info', obj, msg }),
    warn: (obj: Record<string, unknown>, msg?: string) => lines.push({ level: 'warn', obj, msg }),
    error: (obj: Record<string, unknown>, msg?: string) => lines.push({ level: 'error', obj, msg }),
    debug: (obj: Record<string, unknown>, msg?: string) => lines.push({ level: 'debug', obj, msg }),
  }) as unknown as PinoLogger;

const searchPage = (): CardSearchPage => ({
  cards: [
    {
      id: CARD_ID,
      oracleId: CARD_ID,
      name: 'Growth Spiral',
      manaCost: '{G}{U}',
      manaValue: '2',
      typeLine: 'Instant',
      oracleText: 'Draw a card. You may put a land card from your hand onto the battlefield.',
      colorIdentity: ['G', 'U'],
      imageNormal: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 15,
  totalPages: 1,
});

const stubCards = (): CardsService =>
  ({
    search: async (): Promise<CardSearchPage> => searchPage(),
    getById: async () => {
      throw new Error('getById unused');
    },
  }) as unknown as CardsService;

const stubDecks = (): DecksService =>
  ({
    getForUser: async () => {
      throw new Error('getForUser unused');
    },
    listForUser: async () => [],
  }) as unknown as DecksService;

const braidsLine = (): DeckCard => ({
  id: 'line-braids',
  cardId: DECK_CARD_ID,
  printingId: DECK_PRINTING_ID,
  name: 'Braids, Conjurer Adept',
  manaCost: '{3}{U}',
  manaValue: '4',
  typeLine: 'Legendary Creature — Human Wizard',
  oracleText: null,
  colorIdentity: ['U'],
  foil: false,
  hasFoil: false,
  sideboard: false,
  quantity: 1,
  setCode: 'cmm',
  setName: 'Commander Masters',
  collectorNumber: '481',
  imageNormal: null,
  faces: [],
});

const braidsDeck = (): DeckDetail => ({
  deck: {
    id: DECK_ID,
    name: 'Braids',
    description: null,
    format: 'commander',
    commanderPrintingId: DECK_PRINTING_ID,
    colorIdentity: ['U'],
    updatedAt: new Date().toISOString(),
  },
  cards: [braidsLine()],
});

const stubOwnedDecks = (): DecksService =>
  ({
    getForUser: async () => braidsDeck(),
    listForUser: async () => [],
  }) as unknown as DecksService;

const stubChat = (): ChatService =>
  ({
    loadHistory: async () => [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'What would be a good add?' }],
      },
    ],
    appendToolMessage: async () => undefined,
    appendAssistantMessage: async (_conversationId: string, parts: ChatPart[]) => ({
      id: '00000000-0000-4000-8000-0000000000aa',
      parts,
      createdAt: new Date(),
    }),
    loadLinkableCards: async () => [],
    setStickyDeck: async () => undefined,
    setStickyCard: async () => undefined,
  }) as unknown as ChatService;

const runTurn = async (
  provider: ScriptedChatProvider,
  logger: PinoLogger,
  opts?: { decks?: DecksService; deckId?: string | null; chat?: ChatService },
) => {
  const events: ChatServerEvent[] = [];
  const orchestrator = new ChatOrchestrator(
    provider,
    opts?.decks ?? stubDecks(),
    stubCards(),
    opts?.chat ?? stubChat(),
    logger,
  );
  const result = await orchestrator.runTurn({
    clerkUserId: 'user_1',
    deckId: opts?.deckId ?? null,
    conversationId: CONV_ID,
    emit: (event) => events.push(event),
  });
  return { result, events };
};

const turnLog = (lines: LogLine[]) => lines.find((line) => line.obj.event === 'chat.turn');

describe('ChatOrchestrator stop logging', () => {
  it('logs max_tool_calls with the pending names when the budget is spent', async () => {
    const lines: LogLine[] = [];
    const searches = Array.from({ length: CHAT_MAX_TOOL_CALLS }, () => ({
      name: 'searchCards',
      input: { q: 'wheel', limit: 15 },
    }));
    const { events } = await runTurn(
      new ScriptedChatProvider([
        { toolCalls: searches },
        { toolCalls: [{ name: 'searchCards', input: { q: 'more wheels', limit: 15 } }] },
      ]),
      capturingLogger(lines),
    );

    const complete = turnLog(lines);
    expect(complete?.obj.stopReason).toBe('max_tool_calls');
    expect(complete?.obj.pendingTools).toEqual(['searchCards']);
    expect(complete?.obj.error).toBe('I could not finish that recommendation. Try again.');
    expect(lines.some((line) => line.obj.event === 'chat.turn_stopped')).toBe(true);
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('separates text from successive rounds with a paragraph break', async () => {
    const { result, events } = await runTurn(
      new ScriptedChatProvider([
        {
          text: 'Let me search.',
          toolCalls: [{ name: 'searchCards', input: { q: 'draw', limit: 15 } }],
        },
        { text: 'Growth Spiral is a solid add.' },
      ]),
      capturingLogger([]),
    );

    const expected = 'Let me search.\n\nGrowth Spiral is a solid add.';
    expect(result.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: expected })]),
    );
    expect(
      events
        .filter(
          (event): event is Extract<ChatServerEvent, { type: 'text' }> => event.type === 'text',
        )
        .map((event) => event.delta)
        .join(''),
    ).toBe(expected);
  });

  it('still runs presentRecommendations after the catalog budget is spent', async () => {
    const lines: LogLine[] = [];
    const searches = Array.from({ length: CHAT_MAX_TOOL_CALLS }, () => ({
      name: 'searchCards',
      input: { q: 'draw', limit: 15 },
    }));
    const { result, events } = await runTurn(
      new ScriptedChatProvider([
        { toolCalls: searches },
        { toolCalls: [{ name: 'presentRecommendations', input: { cardIds: [CARD_ID] } }] },
        { text: 'Growth Spiral is a solid add.' },
      ]),
      capturingLogger(lines),
    );

    expect(turnLog(lines)?.obj.stopReason).toBe('completed');
    expect(turnLog(lines)?.obj.error).toBeNull();
    expect(events.some((event) => event.type === 'error')).toBe(false);
    expect(result.parts.some((part) => part.type === 'card' || part.type === 'card-list')).toBe(
      false,
    );
    expect(result.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: 'Growth Spiral is a solid add.',
        }),
      ]),
    );
  });

  it('warns with the tool code when arguments fail Zod', async () => {
    const lines: LogLine[] = [];
    await runTurn(
      new ScriptedChatProvider([
        { toolCalls: [{ name: 'searchCards', input: { limit: 0 } }] },
        { text: 'the search failed' },
      ]),
      capturingLogger(lines),
    );

    const failed = lines.find((line) => line.level === 'warn' && line.obj.event === 'chat.tool');
    expect(failed?.obj.code).toBe('invalid_args');
    expect(failed?.obj.name).toBe('searchCards');
    expect(failed?.obj.ok).toBe(false);
    expect(turnLog(lines)?.obj.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'searchCards', ok: false, code: 'invalid_args' }),
      ]),
    );
  });
});

describe('ChatOrchestrator prose card links', () => {
  it('leaves getDeck names in prose unlinked and does not present those ids as thumbs', async () => {
    const lines: LogLine[] = [];
    const { result } = await runTurn(
      new ScriptedChatProvider([
        { toolCalls: [{ name: 'getDeck', input: {} }] },
        { toolCalls: [{ name: 'presentRecommendations', input: { cardIds: [DECK_CARD_ID] } }] },
        { text: 'Braids, Conjurer Adept is your commander.' },
      ]),
      capturingLogger(lines),
      { decks: stubOwnedDecks(), deckId: DECK_ID },
    );

    expect(result.parts.some((part) => part.type === 'card' || part.type === 'card-list')).toBe(
      false,
    );
    expect(result.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: 'Braids, Conjurer Adept is your commander.',
        }),
      ]),
    );
    expect(lines.some((line) => line.obj.event === 'chat.ungrounded_id')).toBe(true);
  });

  it('allowlists a follow-up markdown link from the conversation cache without calling getDeck again', async () => {
    const chat = {
      ...stubChat(),
      loadLinkableCards: async () => [{ id: DECK_CARD_ID, name: 'Braids, Conjurer Adept' }],
    } as ChatService;
    const { result } = await runTurn(
      new ScriptedChatProvider([
        { text: `[Braids, Conjurer Adept](/cards/${DECK_CARD_ID}) is still the commander.` },
      ]),
      capturingLogger([]),
      { chat },
    );
    expect(result.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: `[Braids, Conjurer Adept](/cards/${DECK_CARD_ID}) is still the commander.`,
        }),
      ]),
    );
  });
});
