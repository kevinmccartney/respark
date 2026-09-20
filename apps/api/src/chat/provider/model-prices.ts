/** USD per million tokens. Keys match BEDROCK_MODEL_ID (on-demand and us. inference profiles). */
const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1, output: 5 },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1, output: 5 },
  'anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3, output: 15 },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3, output: 15 },
};

export const estimateUsd = (
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null => {
  const prices = MODEL_PRICES_USD_PER_MILLION[modelId];
  if (!prices) return null;
  const usd = (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output;
  return Math.round(usd * 1_000_000) / 1_000_000;
};
