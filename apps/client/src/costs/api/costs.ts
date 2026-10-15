import { costSummarySchema, type CostSummary } from '@respark/schemas/costs';

import { apiFetchJson, type GetToken } from '@respark-client/core';

export const fetchCostSummary = (getToken: GetToken, init?: RequestInit): Promise<CostSummary> =>
  apiFetchJson('/costs', getToken, costSummarySchema, init);
