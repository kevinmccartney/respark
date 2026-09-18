CREATE TABLE "raw"."mtgjson_card" (
	"mtgjson_uuid" text PRIMARY KEY NOT NULL,
	"scryfall_id" text,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
