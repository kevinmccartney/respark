import { createHash } from 'node:crypto';

/** Deterministic JSON for hashing — sorts object keys recursively. */
export const stableStringify = (value: unknown): string => JSON.stringify(sortValue(value));

export const payloadHash = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
};
