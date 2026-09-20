import type { ChatProvider, ProviderEvent } from './chat-provider';

export type ScriptedRound = {
  text?: string;
  toolCalls?: Array<{ name: string; input: unknown; id?: string }>;
};

/** Offline evals: each `stream()` call consumes the next scripted round. */
export class ScriptedChatProvider implements ChatProvider {
  readonly modelId = 'scripted';
  private index = 0;

  constructor(private readonly rounds: ScriptedRound[]) {}

  async *stream(): AsyncIterable<ProviderEvent> {
    const round = this.rounds[this.index] ?? {};
    this.index += 1;
    if (round.text) {
      yield { type: 'text-delta', delta: round.text };
    }
    for (const [i, call] of (round.toolCalls ?? []).entries()) {
      const id = call.id ?? `scripted-${this.index}-${i}-${call.name}`;
      yield { type: 'tool-call', id, name: call.name };
      yield { type: 'tool-call-end', id, name: call.name, input: call.input };
    }
    yield {
      type: 'stop',
      reason: (round.toolCalls?.length ?? 0) > 0 ? 'tool_use' : 'end_turn',
    };
  }
}
