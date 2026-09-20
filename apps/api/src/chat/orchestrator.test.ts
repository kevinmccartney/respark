import { describe, expect, it } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import type { ChatPart, ChatServerEvent } from 'schemas/chat';
import type { CardSearchPage } from 'schemas/cards';
import type { CardsService } from '../cards/cards.service';
import type { DecksService } from '../decks/decks.service';
import { CHAT_MAX_TOOL_CALLS } from './chat.constants';
import { ChatOrchestrator } from './orchestrator';
import { ScriptedChatProvider } from './provider/scripted.provider';
import type { ChatService } from './chat.service';

const CARD_ID = '00000000-0000-4000-8000-000000000005';
const CONV_ID = '00000000-0000-4000-8000-0000000000bb';

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
    setStickyDeck: async () => undefined,
    setStickyCard: async () => undefined,
  }) as unknown as ChatService;

const runTurn = async (provider: ScriptedChatProvider, logger: PinoLogger) => {
  const events: ChatServerEvent[] = [];
  const orchestrator = new ChatOrchestrator(provider, stubDecks(), stubCards(), stubChat(), logger);
  const result = await orchestrator.runTurn({
    clerkUserId: 'user_1',
    deckId: null,
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
    expect(result.parts.some((part) => part.type === 'card' && part.cardId === CARD_ID)).toBe(true);
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
