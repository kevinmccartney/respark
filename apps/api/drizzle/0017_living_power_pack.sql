CREATE TABLE "ops"."etl_sync_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sync_id" uuid NOT NULL,
	"job_run_id" uuid,
	"stage" text,
	"job" text,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."etl_sync_log" ADD CONSTRAINT "etl_sync_log_sync_id_etl_sync_id_fk" FOREIGN KEY ("sync_id") REFERENCES "ops"."etl_sync"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."etl_sync_log" ADD CONSTRAINT "etl_sync_log_job_run_id_etl_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "ops"."etl_job_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etl_sync_log_sync_id_id_idx" ON "ops"."etl_sync_log" USING btree ("sync_id","id");
