import { Injectable } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import type { DocumentType } from '@smithy/types';
import type {
  ChatProvider,
  ProviderContent,
  ProviderEvent,
  ProviderMessage,
  ProviderToolDef,
} from './chat-provider';

const DEFAULT_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

@Injectable()
export class BedrockChatProvider implements ChatProvider {
  readonly modelId: string;
  private readonly client: BedrockRuntimeClient;

  constructor() {
    this.modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    });
  }

  async *stream(input: {
    system: string;
    messages: ProviderMessage[];
    tools: ProviderToolDef[];
    signal?: AbortSignal;
  }): AsyncIterable<ProviderEvent> {
    const response = await this.client.send(
      new ConverseStreamCommand({
        modelId: this.modelId,
        system: [{ text: input.system }],
        messages: input.messages.map(toBedrockMessage),
        toolConfig: {
          tools: input.tools.map(toBedrockTool),
        },
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.2,
        },
      }),
      { abortSignal: input.signal },
    );

    if (!response.stream) {
      yield { type: 'stop', reason: 'end_turn' };
      return;
    }

    let toolId = '';
    let toolName = '';
    let toolJson = '';

    for await (const event of response.stream) {
      const start = event.contentBlockStart?.start?.toolUse;
      if (start?.toolUseId && start.name) {
        toolId = start.toolUseId;
        toolName = start.name;
        toolJson = '';
        yield { type: 'tool-call', id: toolId, name: toolName };
      }

      const delta = event.contentBlockDelta?.delta;
      if (delta?.text) {
        yield { type: 'text-delta', delta: delta.text };
      }
      if (delta?.toolUse?.input) {
        toolJson += delta.toolUse.input;
      }

      if (event.contentBlockStop && toolId) {
        yield {
          type: 'tool-call-end',
          id: toolId,
          name: toolName,
          input: parseToolInput(toolJson),
        };
        toolId = '';
        toolName = '';
        toolJson = '';
      }

      const usage = event.metadata?.usage;
      if (usage) {
        yield {
          type: 'usage',
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        };
      }

      if (event.messageStop?.stopReason) {
        yield { type: 'stop', reason: event.messageStop.stopReason };
      }
    }
  }
}

const toBedrockTool = (tool: ProviderToolDef): Tool => ({
  toolSpec: {
    name: tool.name,
    description: tool.description,
    inputSchema: { json: asDocument(tool.inputSchema) },
  },
});

const toBedrockMessage = (message: ProviderMessage): Message => ({
  role: message.role,
  content: message.content
    .map(toBedrockBlock)
    .filter((block): block is ContentBlock => Boolean(block)),
});

const toBedrockBlock = (block: ProviderContent): ContentBlock | null => {
  if (block.type === 'text') {
    return { text: block.text || ' ' };
  }
  if (block.type === 'tool-use') {
    return {
      toolUse: {
        toolUseId: block.id,
        name: block.name,
        input: asDocument(block.input),
      },
    };
  }
  return {
    toolResult: {
      toolUseId: block.id,
      content: [{ json: asDocument(block.result) }],
    },
  };
};

const asDocument = (value: unknown): DocumentType => {
  if (value === undefined) return {};
  return JSON.parse(JSON.stringify(value)) as DocumentType;
};

const parseToolInput = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return {};
  }
};
