import { describe, expect, it, vi } from 'vitest';

import type { Deck } from '@respark/schemas/decks';

import type { DecksService } from '../../decks/decks.service';

import { listDecksTool } from './list-decks.tool';

const decks: Deck[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Simic',
    description: null,
    format: 'commander',
    commanderPrintingId: '00000000-0000-4000-8000-000000000010',
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
];

describe('listDecksTool', () => {
  it('returns compact owned decks', async () => {
    const listForUser = vi.fn(async () => decks);
    const tool = listDecksTool({ listForUser } as unknown as DecksService);
    const result = await tool.execute(
      {},
      { clerkUserId: 'user_1', deckId: null, cardId: null, retrievedCardIds: new Set() },
    );
    expect(result).toEqual({
      ok: true,
      data: {
        decks: [
          {
            id: decks[0]?.id,
            name: 'Simic',
            format: 'commander',
            colorIdentity: ['G', 'U'],
          },
        ],
      },
    });
    expect(listForUser).toHaveBeenCalledWith('user_1');
  });
});
