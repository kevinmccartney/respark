CREATE TABLE "ops"."ingestion_error" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"stage" text NOT NULL,
	"error_message" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw"."scryfall_card" (
	"scryfall_id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid,
	"payload" jsonb NOT NULL,
	"source_updated_at" timestamp with time zone,
	"payload_hash" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
