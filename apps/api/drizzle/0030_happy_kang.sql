ALTER TABLE "catalog"."card" ADD COLUMN "produced_mana" text[];--> statement-breakpoint
ALTER TABLE "catalog"."card" ADD COLUMN "has_color_indicator" boolean;--> statement-breakpoint
ALTER TABLE "catalog"."printing" ADD COLUMN "booster" boolean;--> statement-breakpoint
ALTER TABLE "catalog"."printing" ADD COLUMN "promo_types" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."set" ADD COLUMN "block" text;--> statement-breakpoint
ALTER TABLE "catalog"."set" ADD COLUMN "block_code" text;
