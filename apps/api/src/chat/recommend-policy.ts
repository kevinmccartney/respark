export type RecommendPolicyHit = {
  id: string;
  downweight: { kind: string } | null;
};

export type RecommendPolicyInput = {
  userText: string;
  presentedIds: readonly string[];
  retrieved: readonly RecommendPolicyHit[];
};

export type RecommendPolicyViolation = 'all_downweight_slate';

const CLASS_ASK_RE = /\b(tutors?|stax|extra turns?|staples?)\b/i;

export const recommendPolicy = (input: RecommendPolicyInput): RecommendPolicyViolation[] => {
  if (isAllDownweightSlate(input)) return ['all_downweight_slate'];
  return [];
};

export const hitsFromToolResult = (name: string, data: unknown): RecommendPolicyHit[] => {
  if (name === 'searchCards' && data && typeof data === 'object' && 'cards' in data) {
    const cards = (data as { cards?: unknown }).cards;
    if (!Array.isArray(cards)) return [];
    return cards.flatMap((card) => {
      const hit = hitFromUnknown(card);
      return hit ? [hit] : [];
    });
  }
  if (name === 'getCard') {
    const hit = hitFromUnknown(data);
    return hit ? [hit] : [];
  }
  return [];
};

const isAllDownweightSlate = (input: RecommendPolicyInput): boolean => {
  if (input.presentedIds.length === 0) return false;
  if (CLASS_ASK_RE.test(input.userText)) return false;
  const byId = new Map(input.retrieved.map((hit) => [hit.id, hit]));
  const presented = input.presentedIds.map((id) => byId.get(id));
  if (presented.some((hit) => hit === undefined)) return false;
  if (!presented.every((hit) => hit?.downweight !== null)) return false;
  return input.retrieved.some((hit) => hit.downweight === null);
};

const hitFromUnknown = (value: unknown): RecommendPolicyHit | null => {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) return null;
  return { id, downweight: downweightFromUnknown((value as { downweight?: unknown }).downweight) };
};

const downweightFromUnknown = (value: unknown): { kind: string } | null => {
  if (!value || typeof value !== 'object' || !('kind' in value)) return null;
  const kind = (value as { kind?: unknown }).kind;
  if (typeof kind !== 'string' || kind.length === 0) return null;
  return { kind };
};
