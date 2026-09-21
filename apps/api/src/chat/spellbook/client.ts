import {
  SPELLBOOK_BASE_URL,
  SPELLBOOK_RETRY_AFTER_FALLBACK_MS,
  SPELLBOOK_RETRY_AFTER_MAX_MS,
  SPELLBOOK_TIMEOUT_MS,
  SPELLBOOK_USER_AGENT,
} from './constants';
import { slicesFromFindMyCombos, slicesFromVariants } from './parse';
import {
  SpellbookUpstreamError,
  type FindMyCombosResult,
  type SpellbookClient,
  type SpellbookDecklist,
} from './types';

export type SpellbookClientOptions = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  baseUrl?: string;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const retryDelayMs = (retryAfter: string | null): number => {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, SPELLBOOK_RETRY_AFTER_MAX_MS);
  }
  return SPELLBOOK_RETRY_AFTER_FALLBACK_MS;
};

const isAbortError = (err: unknown): boolean =>
  Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError');

export const createSpellbookClient = (opts?: SpellbookClientOptions): SpellbookClient => {
  const doFetch = opts?.fetch ?? fetch;
  const sleep = opts?.sleep ?? defaultSleep;
  const timeoutMs = opts?.timeoutMs ?? SPELLBOOK_TIMEOUT_MS;
  const baseUrl = opts?.baseUrl ?? SPELLBOOK_BASE_URL;

  const request = async (path: string, init?: RequestInit): Promise<unknown> => {
    const run = async (): Promise<
      { kind: 'ok'; body: unknown } | { kind: 'rate'; retryAfter: string | null }
    > => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(`${baseUrl}${path}`, {
          ...init,
          headers: {
            Accept: 'application/json',
            'User-Agent': SPELLBOOK_USER_AGENT,
            ...(init?.headers ?? {}),
          },
          signal: controller.signal,
        });
        if (response.status === 429) {
          return { kind: 'rate', retryAfter: response.headers.get('retry-after') };
        }
        if (!response.ok) {
          throw new SpellbookUpstreamError(`Spellbook returned ${response.status}`);
        }
        return { kind: 'ok', body: await response.json() };
      } catch (err) {
        if (err instanceof SpellbookUpstreamError) throw err;
        if (isAbortError(err)) {
          throw new SpellbookUpstreamError('Spellbook timed out');
        }
        throw new SpellbookUpstreamError('Could not reach Commander Spellbook');
      } finally {
        clearTimeout(timer);
      }
    };

    let result = await run();
    if (result.kind === 'rate') {
      await sleep(retryDelayMs(result.retryAfter));
      result = await run();
      if (result.kind === 'rate') {
        throw new SpellbookUpstreamError('Spellbook rate limited');
      }
    }
    return result.body;
  };

  return {
    findMyCombos: async (decklist: SpellbookDecklist): Promise<FindMyCombosResult> => {
      const body = await request('/find-my-combos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decklist),
      });
      return slicesFromFindMyCombos(body);
    },
    searchVariants: async (q: string, limit: number) => {
      const params = new URLSearchParams({ q, limit: String(limit) });
      const body = await request(`/variants/?${params.toString()}`);
      return slicesFromVariants(body);
    },
  };
};
