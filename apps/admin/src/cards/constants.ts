import { goodstuffTagSchema } from '@respark/schemas';

export const CARDS_LIST_PAGE_SIZE = 40;

export const CARD_SUGGESTION_LIMIT = 10;
export const CARD_SUGGESTION_MIN_CHARS = 2;
export const CARD_SUGGESTION_DEBOUNCE_MS = 200;

export const GOODSTUFF_TAGS = goodstuffTagSchema.options;
