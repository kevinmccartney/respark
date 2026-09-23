import { describe, expect, it } from 'vitest';

import { stickyUnchanged } from './sticky-context';

const stored = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

describe('stickyUnchanged', () => {
  it('keeps the stored id when the client omits it', () => {
    expect(stickyUnchanged(stored, undefined)).toBe(true);
    expect(stickyUnchanged(null, undefined)).toBe(true);
  });

  it('treats explicit null as a change when an id was stored', () => {
    expect(stickyUnchanged(stored, null)).toBe(false);
    expect(stickyUnchanged(null, null)).toBe(true);
  });

  it('does not reject a different id', () => {
    expect(stickyUnchanged(stored, other)).toBe(false);
    expect(stickyUnchanged(null, other)).toBe(false);
    expect(stickyUnchanged(stored, stored)).toBe(true);
  });
});
