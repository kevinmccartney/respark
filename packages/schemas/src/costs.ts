import { z } from 'zod';

import { isoDateTimeSchema } from './primitives.js';

/** Months returned by `GET /costs`, including the current (partial) month. */
export const COST_SUMMARY_MONTHS = 6;

export const serviceCostSchema = z.object({
  service: z.string(),
  amount: z.number(),
});

export type ServiceCost = z.infer<typeof serviceCostSchema>;

export const monthCostSchema = z.object({
  /** First day of the month. */
  month: z.iso.date(),
  total: z.number(),
  /** Largest first. */
  byService: z.array(serviceCostSchema),
});

export type MonthCost = z.infer<typeof monthCostSchema>;

export const costSummarySchema = z.object({
  currency: z.string(),
  /** Oldest first; the last entry is the current month to date. */
  months: z.array(monthCostSchema),
  updatedAt: isoDateTimeSchema,
});

export type CostSummary = z.infer<typeof costSummarySchema>;
