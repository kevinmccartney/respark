ALTER TABLE "catalog"."card" ADD COLUMN "leadership_skills" jsonb;--> statement-breakpoint
UPDATE "catalog"."card" AS c
SET leadership_skills = sub.skills
FROM (
  SELECT DISTINCT ON (p.card_id)
    p.card_id,
    m.payload->'leadershipSkills' AS skills
  FROM catalog.printing p
  JOIN raw.mtgjson_card m ON m.scryfall_id = p.scryfall_id::text
  WHERE m.payload ? 'leadershipSkills'
    AND jsonb_typeof(m.payload->'leadershipSkills') = 'object'
  ORDER BY p.card_id, (m.payload->'leadershipSkills'->>'commander' = 'true') DESC
) AS sub
WHERE c.id = sub.card_id;--> statement-breakpoint
ALTER TABLE "catalog"."card" DROP COLUMN "is_commander";
