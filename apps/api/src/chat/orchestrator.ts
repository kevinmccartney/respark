import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { ChatPart, ChatServerEvent, ChatStatusCode, ChatView, ToolResult } from 'schemas/chat';
import { CardsService } from '../cards/cards.service';
import { DecksService } from '../decks/decks.service';
import { collectLinkableCards, rewriteCardLinks } from './card-links';
import {
  CHAT_MAX_ROUNDS,
  CHAT_MAX_TOOL_CALLS,
  CHAT_PROVIDER_TOKEN,
  CHAT_ROUND_TIMEOUT_MS,
  type ChatTurnStopReason,
} from './chat.constants';
import { ChatService } from './chat.service';
import { textFromParts } from './history';
import { toToolJsonSchema } from './json-schema';
import type {
  ChatProvider,
  ProviderContent,
  ProviderMessage,
  ProviderToolDef,
} from './provider/chat-provider';
import { estimateUsd } from './provider/model-prices';
import { buildChatTools } from './tools/build-tools';
import { executeChatTool } from './tools/registry';
import type { ChatTool, ToolContext } from './tools/types';
import { formatTurnContext } from './turn-context';

const STATUS_CODES = new Set<ChatStatusCode>([
  'thinking',
  'listDecks',
  'getDeck',
  'searchCards',
  'getCard',
  'presentRecommendations',
]);

const PRESENT_TOOL = 'presentRecommendations';
const BUDGET_ERROR = 'I could not finish that recommendation. Try again.';
const TIMEOUT_ERROR = 'That took too long. Try again.';
const PROVIDER_ERROR = 'Something went wrong generating a reply.';

type PendingCall = { id: string; name: string; input: unknown };

type ToolMetric = {
  name: string;
  round: number;
  latencyMs: number;
  ok: boolean;
  code?: string;
};

@Injectable()
export class ChatOrchestrator {
  constructor(
    @Inject(CHAT_PROVIDER_TOKEN)
    private readonly provider: ChatProvider,
    private readonly decks: DecksService,
    private readonly cards: CardsService,
    private readonly chat: ChatService,
    @InjectPinoLogger(ChatOrchestrator.name)
    private readonly logger: PinoLogger,
  ) {}

  async runTurn(opts: {
    clerkUserId: string;
    deckId?: string | null;
    cardId?: string | null;
    view?: ChatView;
    conversationId: string;
    emit: (event: ChatServerEvent) => void;
  }): Promise<{ messageId: string; parts: ChatPart[] }> {
    const started = Date.now();
    const tools = buildChatTools(this.decks, this.cards);
    const toolDefs = tools.map(toProviderToolDef);
    const history = await this.chat.loadHistory(opts.conversationId);
    const messages: ProviderMessage[] = history.map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: textFromParts(row.parts) || ' ' }],
    }));

    const retrievedCardIds = new Set<string>();
    const linkableCards = await this.chat.loadLinkableCards(opts.conversationId);
    const ctx: ToolContext = {
      clerkUserId: opts.clerkUserId,
      deckId: opts.deckId ?? null,
      cardId: opts.cardId ?? null,
      retrievedCardIds,
      onUngrounded: (cardId) => {
        this.logger.warn(
          { event: 'chat.ungrounded_id', cardId, conversationId: opts.conversationId },
          'Dropped ungrounded card id',
        );
      },
    };

    let textAccum = '';
    const toolMetrics: ToolMetric[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let rounds = 0;
    let toolCalls = 0;
    let error: string | undefined;
    let stopReason: ChatTurnStopReason = 'completed';
    let didComplete = false;
    let pendingNames: string[] = [];

    try {
      for (let round = 1; round <= CHAT_MAX_ROUNDS; round += 1) {
        rounds = round;
        const system = formatTurnContext({
          stickyDeckId: ctx.deckId,
          stickyCardId: ctx.cardId,
          view: opts.view,
          groundedCards: linkableCards,
        });
        opts.emit({ type: 'status', code: 'thinking' });
        const pending: PendingCall[] = [];
        let roundText = '';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CHAT_ROUND_TIMEOUT_MS);
        try {
          for await (const event of this.provider.stream({
            system,
            messages,
            tools: toolDefs,
            signal: controller.signal,
          })) {
            if (event.type === 'text-delta') {
              if (!roundText && textAccum) {
                textAccum += '\n\n';
                opts.emit({ type: 'text', delta: '\n\n' });
              }
              roundText += event.delta;
              textAccum += event.delta;
              opts.emit({ type: 'text', delta: event.delta });
            } else if (event.type === 'tool-call' && isStatusCode(event.name)) {
              opts.emit({ type: 'status', code: event.name });
            } else if (event.type === 'tool-call-end') {
              pending.push({ id: event.id, name: event.name, input: event.input });
            } else if (event.type === 'usage') {
              inputTokens += event.inputTokens;
              outputTokens += event.outputTokens;
            }
          }
        } catch (err) {
          if (controller.signal.aborted) {
            stopReason = 'timeout';
            error = TIMEOUT_ERROR;
            this.logStopped(opts.conversationId, {
              stopReason,
              rounds,
              toolCalls,
              pendingNames: pending.map((call) => call.name),
            });
            opts.emit({ type: 'error', message: error });
            break;
          }
          throw err;
        } finally {
          clearTimeout(timer);
        }

        pendingNames = pending.map((call) => call.name);
        if (pending.length === 0) {
          didComplete = true;
          pendingNames = [];
          break;
        }

        const remaining = CHAT_MAX_TOOL_CALLS - toolCalls;
        const { batch, dropped } = splitToolBatch(pending, remaining);
        if (batch.length === 0) {
          stopReason = 'max_tool_calls';
          error = BUDGET_ERROR;
          this.logStopped(opts.conversationId, {
            stopReason,
            rounds,
            toolCalls,
            pendingNames,
            dropped: pendingNames,
          });
          opts.emit({ type: 'error', message: error });
          break;
        }

        toolCalls += batch.length;

        const assistantContent: ProviderContent[] = [];
        if (roundText) assistantContent.push({ type: 'text', text: roundText });
        for (const call of batch) {
          assistantContent.push({
            type: 'tool-use',
            id: call.id,
            name: call.name,
            input: call.input,
          });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        const resultContent: ProviderContent[] = [];
        for (const call of batch) {
          const tool = tools.find((entry) => entry.name === call.name);
          const toolStarted = Date.now();
          const result = tool
            ? await executeChatTool(tool, call.input, ctx, this.logger)
            : { ok: false as const, code: 'unknown_tool', message: `Unknown tool ${call.name}` };
          const latencyMs = Date.now() - toolStarted;
          const metric: ToolMetric = {
            name: call.name,
            round: round,
            latencyMs,
            ok: result.ok,
            ...(result.ok ? {} : { code: result.code }),
          };
          toolMetrics.push(metric);
          this.logTool(opts.conversationId, round, latencyMs, call, result);

          if (result.ok) {
            recordRetrievedIds(call.name, result.data, retrievedCardIds);
            collectLinkableCards(call.name, result.data, linkableCards);
          }
          if (result.ok && call.name === 'getCard') {
            const id = entityIdFromResult(result.data);
            if (id) {
              ctx.cardId = id;
              await this.chat.setStickyCard(opts.conversationId, id);
            }
          }
          if (result.ok && call.name === 'getDeck') {
            const id = entityIdFromResult(result.data);
            if (id) {
              ctx.deckId = id;
              await this.chat.setStickyDeck(opts.conversationId, id);
            }
          }

          await this.chat.appendToolMessage(
            opts.conversationId,
            call.name,
            call.id,
            call.input,
            result,
          );
          resultContent.push({
            type: 'tool-result',
            id: call.id,
            name: call.name,
            result,
          });
        }
        messages.push({ role: 'user', content: resultContent });

        if (dropped.length > 0) {
          const droppedNames = dropped.map((call) => call.name);
          const presented = batch.some((call) => call.name === PRESENT_TOOL);
          this.logStopped(opts.conversationId, {
            stopReason: 'max_tool_calls',
            rounds,
            toolCalls,
            pendingNames,
            dropped: droppedNames,
            executed: batch.map((call) => call.name),
          });
          if (!presented) {
            stopReason = 'max_tool_calls';
            error = BUDGET_ERROR;
            opts.emit({ type: 'error', message: error });
            break;
          }
        }
      }

      if (!didComplete && !error && stopReason === 'completed') {
        stopReason = 'max_rounds';
        this.logStopped(opts.conversationId, {
          stopReason,
          rounds,
          toolCalls,
          pendingNames,
        });
      }
    } catch (err) {
      stopReason = 'provider_error';
      error = PROVIDER_ERROR;
      this.logger.error(
        {
          event: 'chat.turn_failed',
          err,
          conversationId: opts.conversationId,
          rounds,
          toolCalls,
          pendingTools: pendingNames,
          httpStatusCode: awsHttpStatus(err),
        },
        'Chat turn failed',
      );
      opts.emit({ type: 'error', message: error });
    }

    const parts: ChatPart[] = [];
    const linkedText = rewriteCardLinks(textAccum, linkableCards, ctx.onUngrounded);
    if (linkedText.trim()) parts.push({ type: 'text', text: linkedText });
    const saved = await this.chat.appendAssistantMessage(
      opts.conversationId,
      parts.length > 0 ? parts : [{ type: 'text', text: error ?? '' }],
    );

    this.logger.info(
      {
        event: 'chat.turn',
        conversationId: opts.conversationId,
        deckId: ctx.deckId,
        cardId: ctx.cardId,
        viewArea: opts.view?.area ?? null,
        model: this.provider.modelId,
        rounds,
        stopReason,
        pendingTools: pendingNames.length > 0 ? pendingNames : null,
        toolCalls,
        maxToolCalls: CHAT_MAX_TOOL_CALLS,
        maxRounds: CHAT_MAX_ROUNDS,
        tools: toolMetrics,
        inputTokens,
        outputTokens,
        estimatedUsd: estimateUsd(this.provider.modelId, inputTokens, outputTokens),
        latencyMs: Date.now() - started,
        error: error ?? null,
      },
      'Chat turn complete',
    );

    opts.emit({
      type: 'done',
      messageId: saved.id,
      parts: saved.parts,
      deckId: ctx.deckId,
      cardId: ctx.cardId,
    });
    return { messageId: saved.id, parts: saved.parts };
  }

  private logTool(
    conversationId: string,
    round: number,
    latencyMs: number,
    call: PendingCall,
    result: ToolResult<unknown>,
  ) {
    const fields = toolLogFields(call, result, { conversationId, round, latencyMs });
    if (result.ok) {
      this.logger.debug(fields, 'Chat tool finished');
      return;
    }
    this.logger.warn(fields, 'Chat tool failed');
  }

  private logStopped(
    conversationId: string,
    extra: {
      stopReason: ChatTurnStopReason;
      rounds: number;
      toolCalls: number;
      pendingNames: string[];
      dropped?: string[];
      executed?: string[];
    },
  ) {
    this.logger.warn(
      {
        event: 'chat.turn_stopped',
        conversationId,
        stopReason: extra.stopReason,
        rounds: extra.rounds,
        toolCalls: extra.toolCalls,
        maxToolCalls: CHAT_MAX_TOOL_CALLS,
        maxRounds: CHAT_MAX_ROUNDS,
        pendingTools: extra.pendingNames,
        droppedTools: extra.dropped ?? null,
        executedTools: extra.executed ?? null,
      },
      'Chat turn stopped before the model finished',
    );
  }
}

const toProviderToolDef = (tool: ChatTool<unknown, unknown>): ProviderToolDef => ({
  name: tool.name,
  description: tool.description,
  inputSchema: toToolJsonSchema(tool.inputSchema),
});

const isStatusCode = (name: string): name is ChatStatusCode =>
  STATUS_CODES.has(name as ChatStatusCode);

const splitToolBatch = (
  pending: PendingCall[],
  remaining: number,
): { batch: PendingCall[]; dropped: PendingCall[] } => {
  const presents = pending.filter((call) => call.name === PRESENT_TOOL);
  const others = pending.filter((call) => call.name !== PRESENT_TOOL);
  const take = Math.max(0, remaining);
  return {
    batch: [...presents, ...others.slice(0, take)],
    dropped: others.slice(take),
  };
};

const toolLogFields = (
  call: PendingCall,
  result: ToolResult<unknown>,
  extra: { conversationId: string; round: number; latencyMs: number },
): Record<string, unknown> => {
  const input =
    call.input && typeof call.input === 'object' && !Array.isArray(call.input)
      ? (call.input as Record<string, unknown>)
      : {};
  const fields: Record<string, unknown> = {
    event: 'chat.tool',
    name: call.name,
    ok: result.ok,
    round: extra.round,
    conversationId: extra.conversationId,
    latencyMs: extra.latencyMs,
    inputKeys: Object.keys(input),
  };
  if (typeof input.q === 'string') fields.q = input.q;
  if (typeof input.typeContains === 'string') fields.typeContains = input.typeContains;
  if (typeof input.cardId === 'string') fields.cardId = input.cardId;
  if (typeof input.limit === 'number') fields.limit = input.limit;
  if (!result.ok) {
    fields.code = result.code;
    fields.message = result.message;
    return fields;
  }
  if (call.name === 'searchCards' && result.data && typeof result.data === 'object') {
    const data = result.data as { total?: number; cards?: unknown[] };
    fields.hitCount = data.total ?? null;
    fields.resultCount = Array.isArray(data.cards) ? data.cards.length : null;
  }
  if (call.name === PRESENT_TOOL && result.data && typeof result.data === 'object') {
    const data = result.data as { cardIds?: unknown[] };
    fields.presentedCount = Array.isArray(data.cardIds) ? data.cardIds.length : null;
  }
  return fields;
};

const awsHttpStatus = (err: unknown): number | null => {
  if (!err || typeof err !== 'object' || !('$metadata' in err)) return null;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return typeof status === 'number' ? status : null;
};

const recordRetrievedIds = (name: string, data: unknown, retrieved: Set<string>) => {
  if (name === 'searchCards' && data && typeof data === 'object' && 'cards' in data) {
    const cards = (data as { cards?: Array<{ id?: string }> }).cards ?? [];
    for (const card of cards) {
      if (card.id) retrieved.add(card.id);
    }
  }
  if (name === 'getCard' && data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id?: string }).id;
    if (id) retrieved.add(id);
  }
};

const entityIdFromResult = (data: unknown): string | null => {
  if (!data || typeof data !== 'object' || !('id' in data)) return null;
  const id = (data as { id?: string }).id;
  return id ?? null;
};
