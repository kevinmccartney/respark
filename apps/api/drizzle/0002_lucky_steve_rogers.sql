CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE SCHEMA "market";
--> statement-breakpoint
CREATE SCHEMA "raw";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TABLE "ops"."ingestion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"source_version" text,
	"source_url" text,
	"records_seen" bigint DEFAULT 0 NOT NULL,
	"records_inserted" bigint DEFAULT 0 NOT NULL,
	"records_updated" bigint DEFAULT 0 NOT NULL,
	"records_unchanged" bigint DEFAULT 0 NOT NULL,
	"records_failed" bigint DEFAULT 0 NOT NULL,
	"download_bytes" bigint,
	"duration_ms" bigint,
	"error_message" text
);
