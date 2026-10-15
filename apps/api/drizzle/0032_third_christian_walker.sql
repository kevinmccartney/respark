CREATE TABLE "app"."deck_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."deck_revision" ADD CONSTRAINT "deck_revision_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "app"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_revision_deck_id_created_at_idx" ON "app"."deck_revision" USING btree ("deck_id","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Baseline revision for every existing deck, so the first save only lists real changes.
INSERT INTO "app"."deck_revision" ("deck_id", "note", "snapshot", "changes")
SELECT
	d.id,
	'Initial version',
	jsonb_build_object(
		'name', d.name,
		'description', d.description,
		'format', d.format,
		'commander', (
			SELECT jsonb_build_object('printingId', p.id, 'name', c.name)
			FROM "catalog"."printing" p
			JOIN "catalog"."card" c ON c.id = p.card_id
			WHERE p.id = d.commander_printing_id
		),
		'cards', COALESCE((
			SELECT jsonb_agg(
				jsonb_build_object(
					'cardId', c.id,
					'printingId', p.id,
					'name', c.name,
					'setCode', s.code,
					'collectorNumber', p.collector_number,
					'foil', dc.foil,
					'sideboard', dc.sideboard,
					'quantity', dc.quantity
				)
				ORDER BY dc.sideboard, c.name, s.code, p.collector_number, dc.foil
			)
			FROM "app"."deck_card" dc
			JOIN "catalog"."printing" p ON p.id = dc.printing_id
			JOIN "catalog"."card" c ON c.id = p.card_id
			JOIN "catalog"."set" s ON s.id = p.set_id
			WHERE dc.deck_id = d.id
		), '[]'::jsonb)
	),
	'{"cards": [], "details": []}'::jsonb
FROM "app"."decks" d;
