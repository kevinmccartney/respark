import { PRESENT_RECOMMENDATIONS_MAX } from '@respark/schemas/chat';

export const allowlistCardIds = (
  requested: string[],
  retrieved: Set<string>,
  onDrop?: (id: string) => void,
): string[] => {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!retrieved.has(id)) {
      onDrop?.(id);
      continue;
    }
    kept.push(id);
    if (kept.length >= PRESENT_RECOMMENDATIONS_MAX) break;
  }
  return kept;
};
