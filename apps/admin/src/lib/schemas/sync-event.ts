import { ingestionRunStatusSchema } from './etl-sync.ts';
import { isoDateTimeSchema, logLevelSchema, uuidSchema } from './primitives.ts';
import { z } from 'zod';

const syncSummarySchema = z.object({
  id: uuidSchema,
  status: ingestionRunStatusSchema,
  includeCatalog: z.boolean(),
  includeEnrichment: z.boolean(),
  enrichmentJobs: z.array(z.string()),
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  errorMessage: z.string().nullable(),
});

const jobMetricsSchema = z.object({
  recordsSeen: z.number(),
  recordsInserted: z.number(),
  recordsUpdated: z.number(),
  recordsUnchanged: z.number(),
  recordsFailed: z.number(),
  downloadBytes: z.number().nullable(),
  durationMs: z.number().nullable(),
});

export const syncEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sync.started'),
    sync: syncSummarySchema,
  }),
  z.object({
    type: z.literal('sync.updated'),
    syncId: uuidSchema,
    status: ingestionRunStatusSchema,
    completedAt: isoDateTimeSchema.nullable(),
    errorMessage: z.string().nullable(),
  }),
  z.object({
    type: z.literal('sync.completed'),
    syncId: uuidSchema,
    status: ingestionRunStatusSchema,
    completedAt: isoDateTimeSchema,
    errorMessage: z.string().nullable(),
  }),
  z.object({
    type: z.literal('job.started'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    stage: z.string(),
    job: z.string(),
    status: ingestionRunStatusSchema,
    startedAt: isoDateTimeSchema,
  }),
  z.object({
    type: z.literal('job.updated'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    stage: z.string(),
    job: z.string(),
    status: ingestionRunStatusSchema,
    metrics: jobMetricsSchema,
    errorMessage: z.string().nullable(),
  }),
  z.object({
    type: z.literal('job.completed'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    stage: z.string(),
    job: z.string(),
    status: ingestionRunStatusSchema,
    metrics: jobMetricsSchema,
    completedAt: isoDateTimeSchema,
    errorMessage: z.string().nullable(),
  }),
  z.object({
    type: z.literal('job.progress'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    stage: z.string(),
    job: z.string(),
    progress: z.object({
      current: z.number(),
      total: z.number().nullable(),
      cards: z.number(),
      inserted: z.number(),
      updated: z.number(),
      unchanged: z.number(),
      failed: z.number(),
      percent: z.number().nullable(),
    }),
  }),
  z.object({
    type: z.literal('job.log'),
    syncId: uuidSchema,
    jobRunId: uuidSchema.nullable(),
    stage: z.string().nullable(),
    job: z.string().nullable(),
    level: logLevelSchema,
    message: z.string(),
    fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('job.error'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    error: z.object({
      source: z.string(),
      externalId: z.string().nullable(),
      stage: z.string(),
      errorMessage: z.string(),
      payload: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal('job.unmatched'),
    syncId: uuidSchema,
    jobRunId: uuidSchema,
    unmatched: z.object({
      externalId: z.string(),
      name: z.string().nullable(),
      setCode: z.string().nullable(),
      collectorNumber: z.string().nullable(),
      language: z.string().nullable(),
      scryfallId: z.string().nullable(),
      reason: z.string(),
    }),
  }),
]);

export type SyncEvent = z.infer<typeof syncEventSchema>;

export const etlWsEnvelopeSchema = z.object({
  event: z.string(),
  data: z.unknown().optional(),
});
