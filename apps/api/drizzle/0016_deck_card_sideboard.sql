-- Mainboard vs sideboard as separate deck lines for the same printing/foil.
ALTER TABLE "app"."deck_card" ADD COLUMN "sideboard" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX "app"."deck_card_deck_id_printing_id_foil_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "deck_card_deck_printing_foil_sb_uidx" ON "app"."deck_card" USING btree ("deck_id","printing_id","foil","sideboard");
