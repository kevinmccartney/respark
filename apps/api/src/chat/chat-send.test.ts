import { describe, expect, it } from 'vitest';

import { chatSendSchema } from '@respark/schemas/chat';

describe('chatSendSchema', () => {
  it('accepts a deck id and a message', () => {
    const parsed = chatSendSchema.parse({
      message: 'What would be a good add to this deck?',
      context: { deckId: '00000000-0000-4000-8000-000000000001' },
    });
    expect(parsed.conversationId).toBeUndefined();
    expect(parsed.context.deckId).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('allows a send with no deck', () => {
    const parsed = chatSendSchema.parse({
      message: 'Suggest a counterspell',
    });
    expect(parsed.conversationId).toBeUndefined();
    expect(parsed.context.deckId).toBeUndefined();
    expect(parsed.context.cardId).toBeUndefined();
  });

  it('treats explicit null as a clear', () => {
    const parsed = chatSendSchema.parse({
      message: 'never mind the deck',
      context: { deckId: null, cardId: null },
    });
    expect(parsed.context.deckId).toBeNull();
    expect(parsed.context.cardId).toBeNull();
  });

  it('accepts app view metadata alongside sticky ids', () => {
    const parsed = chatSendSchema.parse({
      message: 'what is this card?',
      context: {
        deckId: '00000000-0000-4000-8000-000000000001',
        cardId: '00000000-0000-4000-8000-000000000002',
        view: {
          area: 'card',
          cardId: '00000000-0000-4000-8000-000000000002',
        },
      },
    });
    expect(parsed.context.deckId).toBe('00000000-0000-4000-8000-000000000001');
    expect(parsed.context.view?.area).toBe('card');
  });

  it('rejects a mismatched extra key', () => {
    const result = chatSendSchema.safeParse({
      message: 'hi',
      context: { deckId: '00000000-0000-4000-8000-000000000001' },
      userId: 'attacker',
    });
    expect(result.success).toBe(false);
  });
});
