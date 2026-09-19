-- Track foil vs non-foil as separate deck lines for the same printing.
ALTER TABLE "app"."deck_card" ADD COLUMN "foil" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX "app"."deck_card_deck_id_printing_id_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "deck_card_deck_id_printing_id_foil_uidx" ON "app"."deck_card" USING btree ("deck_id","printing_id","foil");
