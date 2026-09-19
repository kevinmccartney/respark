import { isoDateTimeSchema, uuidSchema } from './primitives.ts';
import { z } from 'zod';

export const ingestionRunStatusSchema = z.enum(['running', 'success', 'partial_success', 'failed']);

export type IngestionRunStatus = z.infer<typeof ingestionRunStatusSchema>;

export const etlJobRunSchema = z.object({
  id: uuidSchema,
  syncId: uuidSchema,
  stage: z.string(),
  job: z.string(),
  status: ingestionRunStatusSchema,
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  sourceVersion: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  recordsSeen: z.number(),
  recordsInserted: z.number(),
  recordsUpdated: z.number(),
  recordsUnchanged: z.number(),
  recordsFailed: z.number(),
  downloadBytes: z.number().nullable(),
  durationMs: z.number().nullable(),
  errorMessage: z.string().nullable(),
});

export type EtlJobRun = z.infer<typeof etlJobRunSchema>;

export const etlStageViewSchema = z.object({
  stage: z.string(),
  jobs: z.array(etlJobRunSchema),
});

export type EtlStageView = z.infer<typeof etlStageViewSchema>;

export const etlSyncSchema = z.object({
  id: uuidSchema,
  status: ingestionRunStatusSchema,
  includeCatalog: z.boolean(),
  includeEnrichment: z.boolean(),
  enrichmentJobs: z.array(z.string()),
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  stages: z.array(etlStageViewSchema),
});

export type EtlSync = z.infer<typeof etlSyncSchema>;

export const etlSyncsResponseSchema = z.object({
  syncs: z.array(etlSyncSchema),
});

export const etlSyncResponseSchema = z.object({
  sync: etlSyncSchema,
});

export const ingestionErrorSchema = z.object({
  id: z.number(),
  runId: uuidSchema,
  source: z.string(),
  externalId: z.string().nullable(),
  stage: z.string(),
  errorMessage: z.string(),
  payload: z.unknown(),
  createdAt: isoDateTimeSchema,
});

export type IngestionError = z.infer<typeof ingestionErrorSchema>;

export const jobErrorsResponseSchema = z.object({
  errors: z.array(ingestionErrorSchema),
  total: z.number(),
});

export const ingestionReconciliationSchema = z.object({
  runId: uuidSchema,
  matched: z.number(),
  unmatched: z.number(),
  ambiguous: z.number(),
  identifiersAdded: z.number(),
  rawInserted: z.number().nullable(),
  rawUpdated: z.number().nullable(),
  rawUnchanged: z.number().nullable(),
  storeRaw: z.boolean().nullable(),
  demoMismatches: z.boolean(),
  dryRun: z.boolean(),
  limitN: z.number().nullable(),
  createdAt: isoDateTimeSchema,
});

export type IngestionReconciliation = z.infer<typeof ingestionReconciliationSchema>;

export const jobReconciliationResponseSchema = z.object({
  reconciliation: ingestionReconciliationSchema.nullable(),
});

export const ingestionUnmatchedSchema = z.object({
  id: z.number(),
  runId: uuidSchema,
  externalId: z.string(),
  name: z.string().nullable(),
  setCode: z.string().nullable(),
  collectorNumber: z.string().nullable(),
  language: z.string().nullable(),
  scryfallId: z.string().nullable(),
  reason: z.string(),
  createdAt: isoDateTimeSchema,
});

export type IngestionUnmatched = z.infer<typeof ingestionUnmatchedSchema>;

export const jobUnmatchedResponseSchema = z.object({
  unmatched: z.array(ingestionUnmatchedSchema),
  total: z.number(),
});

export const startEtlSyncResponseSchema = z.object({
  accepted: z.literal(true),
  catalog: z.boolean(),
  enrichmentJobs: z.array(z.string()),
});
