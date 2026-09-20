ALTER TABLE "catalog"."card" ADD COLUMN "is_commander" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "catalog"."card" AS c
SET is_commander = true
WHERE EXISTS (
  SELECT 1
  FROM catalog.printing p
  JOIN raw.mtgjson_card m ON m.scryfall_id = p.scryfall_id::text
  WHERE p.card_id = c.id
    AND m.payload->'leadershipSkills'->>'commander' = 'true'
);
