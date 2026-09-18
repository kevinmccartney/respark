CREATE TABLE "ops"."ingestion_reconciliation" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"matched" bigint DEFAULT 0 NOT NULL,
	"unmatched" bigint DEFAULT 0 NOT NULL,
	"ambiguous" bigint DEFAULT 0 NOT NULL,
	"identifiers_added" bigint DEFAULT 0 NOT NULL,
	"raw_inserted" bigint,
	"raw_updated" bigint,
	"raw_unchanged" bigint,
	"store_raw" boolean,
	"demo_mismatches" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"limit_n" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."ingestion_unmatched" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"set_code" text,
	"collector_number" text,
	"language" text,
	"scryfall_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."ingestion_reconciliation" ADD CONSTRAINT "ingestion_reconciliation_run_id_ingestion_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."ingestion_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."ingestion_unmatched" ADD CONSTRAINT "ingestion_unmatched_run_id_ingestion_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."ingestion_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_unmatched_run_id_id_idx" ON "ops"."ingestion_unmatched" USING btree ("run_id","id");