-- Deck lines reference a specific printing (default chosen on add from catalog.card).
ALTER TABLE "app"."deck_card" ADD COLUMN "printing_id" uuid;--> statement-breakpoint
UPDATE "app"."deck_card" AS dc
SET "printing_id" = (
  SELECT p.id
  FROM "catalog"."printing" p
  LEFT JOIN "catalog"."card_face" f
    ON f.printing_id = p.id AND f.face_index = 0
  WHERE p.card_id = dc.card_id
  ORDER BY
    (p.image_normal IS NOT NULL OR f.image_normal IS NOT NULL) DESC,
    p.released_at DESC NULLS LAST,
    p.id
  LIMIT 1
);--> statement-breakpoint
DELETE FROM "app"."deck_card" WHERE "printing_id" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."deck_card" ALTER COLUMN "printing_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."deck_card" DROP CONSTRAINT "deck_card_card_id_card_id_fk";--> statement-breakpoint
DROP INDEX "app"."deck_card_deck_id_card_id_uidx";--> statement-breakpoint
ALTER TABLE "app"."deck_card" DROP COLUMN "card_id";--> statement-breakpoint
ALTER TABLE "app"."deck_card" ADD CONSTRAINT "deck_card_printing_id_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "catalog"."printing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_card_deck_id_printing_id_uidx" ON "app"."deck_card" USING btree ("deck_id","printing_id");
