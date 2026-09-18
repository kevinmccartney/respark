CREATE TABLE "ops"."etl_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"include_catalog" boolean NOT NULL,
	"include_enrichment" boolean NOT NULL,
	"enrichment_jobs" text[] DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Backfill: one sync per existing run, reusing the run id so FK wiring stays 1:1
INSERT INTO "ops"."etl_sync" (
	"id",
	"status",
	"include_catalog",
	"include_enrichment",
	"enrichment_jobs",
	"started_at",
	"completed_at",
	"error_message",
	"created_at"
)
SELECT
	"id",
	"status",
	CASE WHEN "source" = 'scryfall' THEN true ELSE false END,
	CASE WHEN "source" = 'mtgjson' THEN true ELSE false END,
	CASE WHEN "source" = 'mtgjson' THEN ARRAY['identifiers']::text[] ELSE '{}'::text[] END,
	"started_at",
	"completed_at",
	"error_message",
	"started_at"
FROM "ops"."ingestion_run";
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_run" RENAME TO "etl_job_run";
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ADD COLUMN "sync_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ADD COLUMN "stage" text;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ADD COLUMN "job" text;
--> statement-breakpoint
UPDATE "ops"."etl_job_run"
SET
	"sync_id" = "id",
	"stage" = CASE WHEN "source" = 'scryfall' THEN 'catalog' ELSE 'enrichment' END,
	"job" = CASE WHEN "source" = 'scryfall' THEN 'catalog' ELSE 'identifiers' END;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ALTER COLUMN "sync_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ALTER COLUMN "stage" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ALTER COLUMN "job" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" DROP COLUMN "source";
--> statement-breakpoint
ALTER TABLE "ops"."etl_job_run" ADD CONSTRAINT "etl_job_run_sync_id_etl_sync_id_fk" FOREIGN KEY ("sync_id") REFERENCES "ops"."etl_sync"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_reconciliation" DROP CONSTRAINT IF EXISTS "ingestion_reconciliation_run_id_ingestion_run_id_fk";
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_unmatched" DROP CONSTRAINT IF EXISTS "ingestion_unmatched_run_id_ingestion_run_id_fk";
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_reconciliation" ADD CONSTRAINT "ingestion_reconciliation_run_id_etl_job_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."etl_job_run"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_unmatched" ADD CONSTRAINT "ingestion_unmatched_run_id_etl_job_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."etl_job_run"("id") ON DELETE cascade ON UPDATE no action;
