import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import type { ChatPart, ChatServerEvent } from 'schemas/chat';
import type { DeckCard, DeckDetail } from 'schemas/decks';
import type { CardSearchPage } from 'schemas/cards';
import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import { ChatOrchestrator } from '../orchestrator';
import { ScriptedChatProvider, type ScriptedRound } from '../provider/scripted.provider';
import type { ChatService } from '../chat.service';
import { cardMatchesSearchFilters, FIXTURE_CARDS, IDS, type FixtureCard } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));

type EvalCase = {
  id: string;
  user: string;
  deckId?: string | null;
  rounds: ScriptedRound[];
  expect: {
    tools: string[];
    recommendationIds?: string[];
    noCardParts?: boolean;
  };
};

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as PinoLogger;

const commanderLine = (): DeckCard => ({
  id: 'line-commander',
  cardId: IDS.commanderCard,
  printingId: IDS.commanderPrinting,
  name: 'Tatyova, Benthic Druid',
  manaCost: '{3}{G}{U}',
  manaValue: '5',
  typeLine: 'Legendary Creature — Merfolk Druid',
  oracleText: null,
  colorIdentity: ['G', 'U'],
  foil: false,
  hasFoil: true,
  sideboard: false,
  quantity: 1,
  setCode: 'dom',
  setName: 'Dominaria',
  collectorNumber: '206',
  imageNormal: null,
  faces: [],
});

const solRingLine = (): DeckCard => ({
  id: 'line-sol',
  cardId: IDS.solRing,
  printingId: '00000000-0000-4000-8000-000000000044',
  name: 'Sol Ring',
  manaCost: '{1}',
  manaValue: '1',
  typeLine: 'Artifact',
  oracleText: null,
  colorIdentity: [],
  foil: false,
  hasFoil: true,
  sideboard: false,
  quantity: 1,
  setCode: 'c21',
  setName: 'Commander 2021',
  collectorNumber: '1',
  imageNormal: null,
  faces: [],
});

const deckDetail = (): DeckDetail => ({
  deck: {
    id: IDS.deck,
    name: 'Tatyova lands',
    description: null,
    format: 'commander',
    commanderPrintingId: IDS.commanderPrinting,
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
  cards: [commanderLine(), solRingLine()],
});

const toSearchCard = (card: FixtureCard) => ({
  id: card.id,
  oracleId: card.id,
  name: card.name,
  manaCost: card.manaCost,
  manaValue: card.manaValue,
  typeLine: card.typeLine,
  oracleText: card.oracleText,
  colorIdentity: card.colorIdentity,
  imageNormal: null,
});

const stubCards = (): CardsService =>
  ({
    search: async (opts: {
      q?: string;
      legalIn?: string;
      colorIdentity?: string[];
      typeContains?: string;
      maxManaValue?: number;
      excludeCardIds?: string[];
      limit?: number;
    }): Promise<CardSearchPage> => {
      const matches = FIXTURE_CARDS.filter((card) => cardMatchesSearchFilters(card, opts));
      const limit = opts.limit ?? 15;
      const cards = matches.slice(0, limit).map(toSearchCard);
      return { cards, total: matches.length, page: 1, pageSize: limit, totalPages: 1 };
    },
    getById: async (id: string) => {
      const card = FIXTURE_CARDS.find((entry) => entry.id === id);
      if (!card) throw new Error('Card not found');
      return {
        ...card,
        oracleId: card.id,
        colors: card.colorIdentity,
        keywords: [],
        leadershipSkills: null,
        layout: 'normal',
        reserved: false,
        printings: [],
      };
    },
  }) as unknown as CardsService;

const loadCases = (): EvalCase[] => {
  const raw = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8')) as EvalCase[];
  return raw;
};

describe('chat fixture evals', () => {
  it.each(loadCases())('$id', async (fixture) => {
    const toolsCalled: string[] = [];
    const searchHits: string[] = [];
    const cards = stubCards();
    const originalSearch = cards.search.bind(cards);
    cards.search = (async (opts) => {
      const page = await originalSearch(opts);
      searchHits.push(...page.cards.map((card) => card.id));
      return page;
    }) as CardsService['search'];

    const chat = {
      loadHistory: async () => [
        {
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: fixture.user }],
        },
      ],
      appendToolMessage: async (_conversationId: string, name: string) => {
        toolsCalled.push(name);
      },
      appendAssistantMessage: async (_conversationId: string, parts: ChatPart[]) => ({
        id: '00000000-0000-4000-8000-0000000000aa',
        parts,
        createdAt: new Date(),
      }),
      setStickyDeck: async () => undefined,
      setStickyCard: async () => undefined,
    };

    const deckId = fixture.deckId === null ? null : (fixture.deckId ?? IDS.deck);
    const getForUser = vi.fn(async (_clerkUserId: string, id: string) => {
      if (id !== IDS.deck) throw new Error(`unexpected deck ${id}`);
      return deckDetail();
    });
    const orchestrator = new ChatOrchestrator(
      new ScriptedChatProvider(fixture.rounds),
      {
        getForUser,
        listForUser: async () => [deckDetail().deck],
      } as unknown as DecksService,
      cards,
      chat as unknown as ChatService,
      silentLogger,
    );

    const events: ChatServerEvent[] = [];
    const result = await orchestrator.runTurn({
      clerkUserId: 'user_1',
      deckId,
      conversationId: '00000000-0000-4000-8000-0000000000bb',
      emit: (event) => events.push(event),
    });

    expect(toolsCalled).toEqual(fixture.expect.tools);

    const recommended = result.parts.flatMap((part) => {
      if (part.type === 'card') return [part.cardId];
      if (part.type === 'card-list') return part.cardIds;
      return [];
    });

    if (fixture.expect.noCardParts) {
      expect(recommended).toEqual([]);
      return;
    }

    expect(recommended.length).toBeGreaterThan(0);
    if (fixture.expect.recommendationIds) {
      expect(recommended).toEqual(fixture.expect.recommendationIds);
    }
    expect(recommended.every((id) => searchHits.includes(id))).toBe(true);

    if (deckId || fixture.expect.tools.includes('getDeck')) {
      const inDeck = new Set(deckDetail().cards.map((card) => card.cardId));
      const identity = new Set(deckDetail().deck.colorIdentity);
      for (const id of recommended) {
        const card = FIXTURE_CARDS.find((entry) => entry.id === id);
        expect(card).toBeTruthy();
        expect(inDeck.has(id)).toBe(false);
        expect(card?.legalities.commander).toBe('legal');
        expect(card?.colorIdentity.every((pip) => identity.has(pip))).toBe(true);
      }
    }

    expect(events.some((event) => event.type === 'done')).toBe(true);
  });
});
