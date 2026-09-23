import { describe, expect, it, vi } from 'vitest';

import { createSpellbookClient } from './client';
import { SPELLBOOK_USER_AGENT } from './constants';
import { SpellbookUpstreamError } from './types';

const variant = {
  id: 'combo-1',
  uses: [{ card: { name: 'Sol Ring', oracleId: '00000000-0000-4000-8000-000000000004' } }],
  produces: [{ feature: { name: 'Infinite mana' } }],
  manaNeeded: '{1}',
  description: 'Tap Sol Ring.',
  popularity: 12,
  bracketTag: '2',
};

const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('createSpellbookClient', () => {
  it('POSTs find-my-combos with the required User-Agent and maps included variants', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: { included: [variant], almostIncluded: [] },
      }),
    );
    const client = createSpellbookClient({ fetch: fetchMock });
    const result = await client.findMyCombos({
      commanders: [{ card: 'Tatyova, Benthic Druid', quantity: 1 }],
      main: [{ card: 'Sol Ring', quantity: 1 }],
    });
    expect(result.included).toEqual([
      {
        id: 'combo-1',
        uses: [{ name: 'Sol Ring', oracleId: '00000000-0000-4000-8000-000000000004' }],
        produces: ['Infinite mana'],
        manaNeeded: '{1}',
        description: 'Tap Sol Ring.',
        popularity: 12,
        bracketTag: '2',
      },
    ]);
    expect(result.almostIncluded).toEqual([]);
    const request = fetchMock.mock.calls[0]?.[0];
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(request)).toContain('/find-my-combos/');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('User-Agent')).toBe(SPELLBOOK_USER_AGENT);
  });

  it('retries once on 429 using Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'slow down' }, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(jsonResponse({ results: [variant] }));
    const sleep = vi.fn(async () => undefined);
    const client = createSpellbookClient({ fetch: fetchMock, sleep });
    const variants = await client.searchVariants('card:"Sol Ring"', 8);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(variants).toHaveLength(1);
    expect(variants[0]?.id).toBe('combo-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails soft after a second 429', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 429));
    const client = createSpellbookClient({ fetch: fetchMock, sleep: async () => undefined });
    await expect(client.searchVariants('infinite', 8)).rejects.toBeInstanceOf(
      SpellbookUpstreamError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on a non-429 upstream status', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500));
    const client = createSpellbookClient({ fetch: fetchMock });
    await expect(client.findMyCombos({ commanders: [], main: [] })).rejects.toMatchObject({
      code: 'upstream',
    });
  });
});
