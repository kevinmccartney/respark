import { describe, expect, it } from 'vitest';

import { selectHistoryMessages, textFromParts } from './history';

describe('selectHistoryMessages', () => {
  it('keeps the last 12 user/assistant rows', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      role: i % 3 === 0 ? 'tool' : i % 2 === 0 ? 'user' : 'assistant',
      i,
    }));
    const selected = selectHistoryMessages(rows);
    expect(selected).toHaveLength(12);
    expect(selected.every((row) => row.role !== 'tool')).toBe(true);
    expect(selected[0]?.i).toBeGreaterThan(0);
  });
});

describe('textFromParts', () => {
  it('joins text parts', () => {
    expect(
      textFromParts([
        { type: 'text', text: 'Hello' },
        { type: 'card', cardId: '00000000-0000-4000-8000-000000000001' },
        { type: 'text', text: 'world' },
      ]),
    ).toBe('Hello\nworld');
  });
});
