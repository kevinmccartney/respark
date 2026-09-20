import { Injectable } from '@nestjs/common';
import { PRESENT_RECOMMENDATIONS_MAX, SEARCH_CARDS_TOOL_DEFAULT_LIMIT } from 'schemas/chat';
import type {
  ChatProvider,
  ProviderContent,
  ProviderEvent,
  ProviderMessage,
  ProviderToolDef,
} from './chat-provider';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const lastToolResults = (
  messages: ProviderMessage[],
): Extract<ProviderContent, { type: 'tool-result' }>[] => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const results = message.content.filter(
      (block): block is Extract<ProviderContent, { type: 'tool-result' }> =>
        block.type === 'tool-result',
    );
    if (results.length > 0) return results;
  }
  return [];
};

const lastUserText = (messages: ProviderMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const text = message.content
      .filter((block): block is Extract<ProviderContent, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim();
    if (text) return text;
  }
  return '';
};

const lastToolUseInput = (messages: ProviderMessage[], name: string): unknown => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'assistant') continue;
    for (let j = message.content.length - 1; j >= 0; j -= 1) {
      const block = message.content[j];
      if (block?.type === 'tool-use' && block.name === name) return block.input;
    }
  }
  return undefined;
};

const idsFromSearchResult = (result: unknown): string[] => {
  if (!result || typeof result !== 'object' || !('ok' in result)) return [];
  const payload = result as { ok: boolean; data?: { cards?: Array<{ id?: string }> } };
  if (!payload.ok) return [];
  return (payload.data?.cards ?? [])
    .map((card) => card.id)
    .filter((id): id is string => Boolean(id));
};

const toolError = (result: unknown): { code?: string; message: string } | null => {
  if (!result || typeof result !== 'object' || !('ok' in result)) return null;
  const payload = result as { ok: boolean; code?: string; message?: string };
  if (payload.ok) return null;
  return {
    code: payload.code,
    message: payload.message ?? 'A catalog tool failed. I will not invent cards.',
  };
};

const decksFromList = (result: unknown): Array<{ id: string; name: string }> => {
  if (!result || typeof result !== 'object' || !('ok' in result)) return [];
  const payload = result as {
    ok: boolean;
    data?: { decks?: Array<{ id?: string; name?: string }> };
  };
  if (!payload.ok) return [];
  return (payload.data?.decks ?? []).filter((deck): deck is { id: string; name: string } =>
    Boolean(deck.id && deck.name),
  );
};

export const parseMockTurnContext = (
  system: string,
): { stickyDeckId?: string; viewingDeckId?: string } => {
  const sticky = new RegExp(`^- deckId: (${UUID}|none)`, 'im').exec(system);
  const viewing = new RegExp(`^- viewingDeckId: (${UUID})`, 'im').exec(system);
  const stickyDeckId = sticky?.[1] && sticky[1] !== 'none' ? sticky[1] : undefined;
  return { stickyDeckId, viewingDeckId: viewing?.[1] };
};

/** Questions about the assistant itself — not catalog searches. */
export const isCapabilityAsk = (text: string): boolean => {
  const t = text.toLowerCase();
  return (
    /\bwho are you\b/.test(t) ||
    /\bwhat can you do\b/.test(t) ||
    /\bwhat do you do\b/.test(t) ||
    /\bdo you know\b/.test(t) ||
    /\bhow (does|do) (this|the) app\b/.test(t)
  );
};

export const refersToOpenDeck = (text: string): boolean =>
  /\b(this deck|the deck I(?:'m| am) looking at|looking at|on (?:this|the) page|use the deck)\b/i.test(
    text,
  );

export const refersToNamedDeck = (text: string): boolean => /\bmy\s+\S[\s\S]*\bdeck\b/i.test(text);

export const isDeckAddAsk = (text: string): boolean =>
  /\b(good add|add to this deck|recommend\w* (?:for|to) (?:this )?deck)\b/i.test(text);

/**
 * Keyword `q` only when the utterance looks like a catalog query.
 * Conversational sentences ("what would be a good add…") must not be ILIKE'd.
 */
export const catalogSearchInput = (text: string): Record<string, unknown> => {
  const input: Record<string, unknown> = { limit: SEARCH_CARDS_TOOL_DEFAULT_LIMIT };
  const lower = text.toLowerCase();
  if (/\bcreatures?\b/.test(lower)) input.typeContains = 'Creature';
  else if (/\binstants?\b/.test(lower)) input.typeContains = 'Instant';
  else if (/\bsorcer(?:y|ies)\b/.test(lower)) input.typeContains = 'Sorcery';
  else if (/\bartifacts?\b/.test(lower) || /\brocks?\b/.test(lower))
    input.typeContains = 'Artifact';
  if (/\bcheap\b/.test(lower) || /\bone[- ]mana\b/.test(lower)) input.maxManaValue = 1;

  const trimmed = text.trim().replace(/[?!.]+$/g, '');
  const words = trimmed.split(/\s+/).filter(Boolean);
  const first = words[0]?.toLowerCase() ?? '';
  const skipFirst =
    /^(what|who|how|why|where|suggest|recommend|give|show|tell|can|could|please|i|a|an|the)$/.test(
      first,
    );
  if (trimmed && words.length <= 3 && !skipFirst) input.q = trimmed;
  return input;
};

const matchDeck = (
  text: string,
  decks: Array<{ id: string; name: string }>,
): { id: string; name: string } | undefined => {
  const lower = text.toLowerCase();
  const hits = decks.filter((deck) => lower.includes(deck.name.toLowerCase()));
  return hits.sort((a, b) => b.name.length - a.name.length)[0];
};

const getDeckInput = (deckId: string | undefined): Record<string, unknown> =>
  deckId ? { deckId } : {};

const toolCall = function* (name: string, input: unknown): Generator<ProviderEvent> {
  const id = `mock-${name}`;
  yield { type: 'tool-call', id, name };
  yield { type: 'tool-call-end', id, name, input };
  yield { type: 'stop', reason: 'tool_use' };
};

const CAPABILITY_REPLY =
  "I'm Respark's assistant. I look up your decks and the card catalog, suggest adds that fit a list's colors and format, and talk about the page you have open. I don't invent cards.";

/**
 * Local provider: attach the open/named/sticky deck, then searchCards → presentRecommendations.
 * Does not stuff the raw user sentence into catalog `q`.
 */
@Injectable()
export class MockChatProvider implements ChatProvider {
  readonly modelId = 'mock';

  async *stream(input: {
    system: string;
    messages: ProviderMessage[];
    tools?: ProviderToolDef[];
  }): AsyncIterable<ProviderEvent> {
    const results = lastToolResults(input.messages);
    const toolNames = new Set((input.tools ?? []).map((tool) => tool.name));
    const hasGetDeck = toolNames.has('getDeck');
    const hasListDecks = toolNames.has('listDecks');
    const userText = lastUserText(input.messages);
    const turn = parseMockTurnContext(input.system ?? '');
    const wantsDeck =
      refersToOpenDeck(userText) || refersToNamedDeck(userText) || isDeckAddAsk(userText);

    if (results.length === 0) {
      if (isCapabilityAsk(userText)) {
        yield { type: 'text-delta', delta: CAPABILITY_REPLY };
        yield { type: 'stop', reason: 'end_turn' };
        return;
      }
      if (hasGetDeck && turn.viewingDeckId && wantsDeck) {
        yield* toolCall('getDeck', getDeckInput(turn.viewingDeckId));
        return;
      }
      if (hasListDecks && refersToNamedDeck(userText) && !turn.stickyDeckId) {
        yield* toolCall('listDecks', {});
        return;
      }
      if (hasGetDeck && (turn.stickyDeckId || isDeckAddAsk(userText))) {
        yield* toolCall('getDeck', {});
        return;
      }
      yield* toolCall('searchCards', catalogSearchInput(userText));
      return;
    }

    const last = results[results.length - 1];
    if (!last) {
      yield { type: 'text-delta', delta: 'I could not read that tool result.' };
      yield { type: 'stop', reason: 'end_turn' };
      return;
    }

    const fail = toolError(last.result);
    if (fail) {
      if (last.name === 'getDeck' && fail.code === 'no_deck_context') {
        const used = lastToolUseInput(input.messages, 'getDeck');
        const usedId =
          used && typeof used === 'object' && used !== null && 'deckId' in used
            ? (used as { deckId?: string }).deckId
            : undefined;
        if (hasGetDeck && turn.viewingDeckId && usedId !== turn.viewingDeckId) {
          yield* toolCall('getDeck', getDeckInput(turn.viewingDeckId));
          return;
        }
        if (hasListDecks && wantsDeck) {
          yield* toolCall('listDecks', {});
          return;
        }
        yield* toolCall('searchCards', catalogSearchInput(userText));
        return;
      }
      yield { type: 'text-delta', delta: fail.message };
      yield { type: 'stop', reason: 'end_turn' };
      return;
    }

    if (last.name === 'listDecks') {
      const decks = decksFromList(last.result);
      const named = matchDeck(userText, decks);
      const deckId =
        named?.id ?? turn.viewingDeckId ?? (decks.length === 1 ? decks[0]?.id : undefined);
      if (hasGetDeck && deckId) {
        yield* toolCall('getDeck', getDeckInput(deckId));
        return;
      }
      yield {
        type: 'text-delta',
        delta:
          decks.length === 0
            ? 'You have no decks yet.'
            : `I couldn't match that to a list. Your decks: ${decks.map((deck) => deck.name).join(', ')}.`,
      };
      yield { type: 'stop', reason: 'end_turn' };
      return;
    }

    if (last.name === 'getDeck') {
      if (isCapabilityAsk(userText)) {
        yield { type: 'text-delta', delta: CAPABILITY_REPLY };
        yield { type: 'stop', reason: 'end_turn' };
        return;
      }
      yield* toolCall('searchCards', catalogSearchInput(userText));
      return;
    }

    if (last.name === 'searchCards') {
      const ids = idsFromSearchResult(last.result).slice(0, PRESENT_RECOMMENDATIONS_MAX);
      if (ids.length === 0) {
        yield {
          type: 'text-delta',
          delta: 'I could not find a catalog card that fits.',
        };
        yield { type: 'stop', reason: 'end_turn' };
        return;
      }
      yield* toolCall('presentRecommendations', { cardIds: ids });
      return;
    }

    yield {
      type: 'text-delta',
      delta: hasGetDeck
        ? 'Here are catalog cards that fit this deck’s identity and format.'
        : 'Here are catalog cards that match.',
    };
    yield { type: 'stop', reason: 'end_turn' };
  }
}
