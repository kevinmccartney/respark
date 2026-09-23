import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CHAT_CONVERSATION_TITLE_MAX } from '@respark/schemas/chat';

const DEFAULT_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const TITLE_SYSTEM = `Summarize this Magic: The Gathering chat opener as a short history title.
Rules: max ${CHAT_CONVERSATION_TITLE_MAX} characters, no quotes, no trailing punctuation.
Return ONLY the title.`;

/** Clamp/clean a raw title string for storage and display. */
export const clampConversationTitle = (raw: string): string => {
  let text = raw.replace(/\s+/g, ' ').trim();
  text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
  text = text.replace(/[.!?…]+$/g, '').trim();
  if (!text) return 'New chat';
  if (text.length <= CHAT_CONVERSATION_TITLE_MAX) return text;

  const sliced = text.slice(0, CHAT_CONVERSATION_TITLE_MAX);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace >= 20 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}…`;
};

@Injectable()
export class ConversationTitleGenerator {
  private readonly client: BedrockRuntimeClient | null;
  private readonly modelId: string;

  constructor(
    @InjectPinoLogger(ConversationTitleGenerator.name)
    private readonly logger: PinoLogger,
  ) {
    const useMock = (process.env.CHAT_PROVIDER ?? 'bedrock').toLowerCase() === 'mock';
    this.modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;
    this.client = useMock
      ? null
      : new BedrockRuntimeClient({
          region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
        });
  }

  async generate(userText: string): Promise<string> {
    const fallback = clampConversationTitle(userText);
    if (!this.client) return fallback;

    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: TITLE_SYSTEM }],
          messages: [
            {
              role: 'user',
              content: [{ text: userText.slice(0, 2000) || ' ' }],
            },
          ],
          inferenceConfig: {
            maxTokens: 64,
            temperature: 0.2,
          },
        }),
      );

      const generated =
        response.output?.message?.content
          ?.map((block) => block.text?.trim() ?? '')
          .filter(Boolean)
          .join(' ')
          .trim() ?? '';

      const title = clampConversationTitle(generated);
      return title === 'New chat' ? fallback : title;
    } catch (error) {
      this.logger.warn(
        { event: 'chat.title.generate_failed', err: error },
        'Failed to generate conversation title; using truncated prompt',
      );
      return fallback;
    }
  }
}
