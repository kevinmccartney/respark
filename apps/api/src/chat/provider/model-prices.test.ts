import { describe, expect, it } from 'vitest';
import { estimateUsd } from './model-prices';

describe('estimateUsd', () => {
  it('prices Haiku 4.5 from token counts', () => {
    expect(estimateUsd('us.anthropic.claude-haiku-4-5-20251001-v1:0', 1_000_000, 1_000_000)).toBe(
      6,
    );
  });

  it('returns null for an unknown model', () => {
    expect(estimateUsd('some.other.model', 100, 100)).toBeNull();
  });
});
