-- Deck metadata for MVP builder.
ALTER TABLE "app"."decks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "app"."decks" ADD COLUMN "format" text DEFAULT 'standard' NOT NULL;
