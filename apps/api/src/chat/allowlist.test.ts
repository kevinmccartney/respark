import { describe, expect, it, vi } from 'vitest';

import { PRESENT_RECOMMENDATIONS_MAX } from '@respark/schemas/chat';

import { allowlistCardIds } from './allowlist';

describe('allowlistCardIds', () => {
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const c = '00000000-0000-4000-8000-000000000003';

  it('keeps retrieved ids and drops the rest', () => {
    const dropped: string[] = [];
    expect(allowlistCardIds([a, c, a, b], new Set([a, b]), (id) => dropped.push(id))).toEqual([
      a,
      b,
    ]);
    expect(dropped).toEqual([c]);
  });

  it('caps at PRESENT_RECOMMENDATIONS_MAX', () => {
    const ids = Array.from(
      { length: PRESENT_RECOMMENDATIONS_MAX + 3 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    );
    expect(allowlistCardIds(ids, new Set(ids))).toHaveLength(PRESENT_RECOMMENDATIONS_MAX);
  });
});

describe('allowlist logging hook', () => {
  it('is optional', () => {
    const spy = vi.fn();
    allowlistCardIds(['00000000-0000-4000-8000-000000000009'], new Set(), spy);
    expect(spy).toHaveBeenCalledOnce();
  });
});
