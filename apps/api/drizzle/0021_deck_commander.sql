ALTER TABLE "app"."decks" ADD COLUMN "commander_printing_id" uuid;--> statement-breakpoint
UPDATE "app"."decks" SET "format" = 'standard' WHERE "format" = 'commander';--> statement-breakpoint
ALTER TABLE "app"."decks" ADD CONSTRAINT "decks_commander_printing_id_printing_id_fk" FOREIGN KEY ("commander_printing_id") REFERENCES "catalog"."printing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."decks" ADD CONSTRAINT "decks_commander_matches_format_chk" CHECK ((
        ("app"."decks"."format" = 'commander' AND "app"."decks"."commander_printing_id" IS NOT NULL)
        OR ("app"."decks"."format" <> 'commander' AND "app"."decks"."commander_printing_id" IS NULL)
      ));