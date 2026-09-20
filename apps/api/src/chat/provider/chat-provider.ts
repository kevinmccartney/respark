export type ProviderContent =
  | { type: 'text'; text: string }
  | { type: 'tool-use'; id: string; name: string; input: unknown }
  | { type: 'tool-result'; id: string; name: string; result: unknown };

export type ProviderMessage = {
  role: 'user' | 'assistant';
  content: ProviderContent[];
};

export type ProviderToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ProviderEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; id: string; name: string }
  | { type: 'tool-call-end'; id: string; name: string; input: unknown }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'stop'; reason: string };

export type ChatProvider = {
  readonly modelId: string;
  stream(input: {
    system: string;
    messages: ProviderMessage[];
    tools: ProviderToolDef[];
    signal?: AbortSignal;
  }): AsyncIterable<ProviderEvent>;
};
