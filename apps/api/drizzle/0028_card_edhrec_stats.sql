ALTER TABLE "catalog"."card" ADD COLUMN "edhrec_rank" integer;--> statement-breakpoint
ALTER TABLE "catalog"."card" ADD COLUMN "edhrec_saltiness" numeric;--> statement-breakpoint
ALTER TABLE "catalog"."card" ADD COLUMN "is_game_changer" boolean;--> statement-breakpoint
UPDATE "catalog"."card" AS c
SET
  edhrec_rank = sub.edhrec_rank,
  is_game_changer = sub.is_game_changer
FROM (
  SELECT DISTINCT ON (p.card_id)
    p.card_id,
    CASE
      WHEN s.payload ? 'edhrec_rank'
        AND jsonb_typeof(s.payload->'edhrec_rank') = 'number'
      THEN (s.payload->>'edhrec_rank')::int
      ELSE NULL
    END AS edhrec_rank,
    CASE
      WHEN s.payload ? 'game_changer'
        AND jsonb_typeof(s.payload->'game_changer') = 'boolean'
      THEN (s.payload->>'game_changer')::boolean
      ELSE NULL
    END AS is_game_changer
  FROM catalog.printing p
  JOIN raw.scryfall_card s ON s.scryfall_id = p.scryfall_id
  WHERE s.payload ? 'edhrec_rank' OR s.payload ? 'game_changer'
  ORDER BY p.card_id,
    (s.payload->>'edhrec_rank')::int ASC NULLS LAST,
    (s.payload->>'game_changer')::boolean DESC NULLS LAST
) AS sub
WHERE c.id = sub.card_id;--> statement-breakpoint
UPDATE "catalog"."card" AS c
SET edhrec_saltiness = sub.salt
FROM (
  SELECT DISTINCT ON (p.card_id)
    p.card_id,
    (m.payload->>'edhrecSaltiness')::numeric AS salt
  FROM catalog.printing p
  JOIN raw.mtgjson_card m ON m.scryfall_id = p.scryfall_id::text
  WHERE m.payload ? 'edhrecSaltiness'
    AND jsonb_typeof(m.payload->'edhrecSaltiness') = 'number'
  ORDER BY p.card_id
) AS sub
WHERE c.id = sub.card_id
  AND c.edhrec_saltiness IS NULL;--> statement-breakpoint
UPDATE "catalog"."card" AS c
SET is_game_changer = true
FROM (
  SELECT DISTINCT p.card_id
  FROM catalog.printing p
  JOIN raw.mtgjson_card m ON m.scryfall_id = p.scryfall_id::text
  WHERE m.payload->>'isGameChanger' = 'true'
) AS sub
WHERE c.id = sub.card_id
  AND c.is_game_changer IS NULL;--> statement-breakpoint
CREATE INDEX "card_edhrec_rank_idx" ON "catalog"."card" ("edhrec_rank" ASC NULLS LAST);--> statement-breakpoint
CREATE TABLE "app"."recommendation_downweight" (
  "card_id" uuid PRIMARY KEY NOT NULL REFERENCES "catalog"."card"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recommendation_downweight_kind_chk" CHECK (
    "kind" IN ('staple', 'tutor', 'extra_turn', 'stax', 'other')
  )
);--> statement-breakpoint
INSERT INTO "app"."recommendation_downweight" ("card_id", "kind", "note")
SELECT c.id, s.kind, s.note
FROM (
  VALUES
    ('Rhystic Study', 'staple', 'Format-wide extra-mana tax'),
    ('Smothering Tithe', 'staple', 'Format-wide extra-mana tax'),
    ('Cyclonic Rift', 'staple', 'Generic one-sided board wipe'),
    ('Dockside Extortionist', 'staple', 'Generic treasure engine'),
    ('Esper Sentinel', 'staple', 'Generic card-advantage staple'),
    ('The One Ring', 'staple', 'Generic card-advantage staple'),
    ('Fierce Guardianship', 'staple', 'Free-spell cycle staple'),
    ('Deadly Rollick', 'staple', 'Free-spell cycle staple'),
    ('Deflecting Swat', 'staple', 'Free-spell cycle staple'),
    ('Teferi''s Protection', 'staple', 'Generic fog / protection'),
    ('Demonic Tutor', 'tutor', 'Generic black tutor'),
    ('Vampiric Tutor', 'tutor', 'Generic black tutor'),
    ('Imperial Seal', 'tutor', 'Generic black tutor'),
    ('Mystical Tutor', 'tutor', 'Generic blue instant/sorcery tutor'),
    ('Enlightened Tutor', 'tutor', 'Generic white enchantment/artifact tutor'),
    ('Worldly Tutor', 'tutor', 'Generic green creature tutor'),
    ('Grim Tutor', 'tutor', 'Generic black tutor'),
    ('Time Warp', 'extra_turn', 'Generic extra turn'),
    ('Nexus of Fate', 'extra_turn', 'Generic extra turn'),
    ('Temporal Manipulation', 'extra_turn', 'Generic extra turn'),
    ('Drannith Magistrate', 'stax', 'Generic commander-tax stax'),
    ('Rule of Law', 'stax', 'Generic spell-limit stax'),
    ('Winter Orb', 'stax', 'Generic mana stax')
) AS s(name, kind, note)
JOIN "catalog"."card" c ON c.name = s.name
ON CONFLICT ("card_id") DO NOTHING;
