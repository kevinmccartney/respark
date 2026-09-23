import { describe, expect, it } from 'vitest';

import { tokenFromWsUrl } from './ws-auth';

describe('tokenFromWsUrl', () => {
  it('reads the query token', () => {
    expect(tokenFromWsUrl('/chat/ws?token=abc')).toBe('abc');
  });

  it('returns null when missing', () => {
    expect(tokenFromWsUrl('/chat/ws')).toBeNull();
    expect(tokenFromWsUrl(undefined)).toBeNull();
  });
});
