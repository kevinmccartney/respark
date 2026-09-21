export type RecommendPolicyHit = {
  id: string;
  goodstuff: { tags: string[] } | null;
};

export type RecommendPolicyInput = {
  userText: string;
  presentedIds: readonly string[];
  retrieved: readonly RecommendPolicyHit[];
};

export type RecommendPolicyViolation = 'all_goodstuff_slate';

const CLASS_ASK_RE =
  /\b(goodstuff|interaction|ramp|removal|counterspells?|board\s*wipes?|stax|tutors?|fast\s*mana)\b/i;

export const recommendPolicy = (input: RecommendPolicyInput): RecommendPolicyViolation[] => {
  if (isAllGoodstuffSlate(input)) return ['all_goodstuff_slate'];
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

const isAllGoodstuffSlate = (input: RecommendPolicyInput): boolean => {
  if (input.presentedIds.length === 0) return false;
  if (CLASS_ASK_RE.test(input.userText)) return false;
  const byId = new Map(input.retrieved.map((hit) => [hit.id, hit]));
  const presented = input.presentedIds.map((id) => byId.get(id));
  if (presented.some((hit) => hit === undefined)) return false;
  if (!presented.every((hit) => hit?.goodstuff !== null)) return false;
  return input.retrieved.some((hit) => hit.goodstuff === null);
};

const hitFromUnknown = (value: unknown): RecommendPolicyHit | null => {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) return null;
  return { id, goodstuff: goodstuffFromUnknown((value as { goodstuff?: unknown }).goodstuff) };
};

const goodstuffFromUnknown = (value: unknown): { tags: string[] } | null => {
  if (!value || typeof value !== 'object' || !('tags' in value)) return null;
  const tags = (value as { tags?: unknown }).tags;
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const parsed = tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
  if (parsed.length === 0) return null;
  return { tags: parsed };
};
