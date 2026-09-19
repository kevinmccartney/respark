-- Deck lines: one row per unique catalog card in a deck.
CREATE TABLE "app"."deck_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "app"."deck_card" ADD CONSTRAINT "deck_card_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "app"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deck_card" ADD CONSTRAINT "deck_card_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "catalog"."card"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_card_deck_id_card_id_uidx" ON "app"."deck_card" USING btree ("deck_id","card_id");--> statement-breakpoint
CREATE INDEX "deck_card_deck_id_idx" ON "app"."deck_card" USING btree ("deck_id");
