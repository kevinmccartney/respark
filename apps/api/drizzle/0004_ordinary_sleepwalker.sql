CREATE TABLE "catalog"."card_face" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printing_id" uuid NOT NULL,
	"face_index" integer NOT NULL,
	"name" text,
	"mana_cost" text,
	"type_line" text,
	"oracle_text" text,
	"colors" text[],
	"power" text,
	"toughness" text,
	"loyalty" text,
	"defense" text,
	"image_normal" text,
	"image_large" text,
	CONSTRAINT "card_face_printing_id_face_index_uidx" UNIQUE("printing_id","face_index")
);
--> statement-breakpoint
CREATE TABLE "catalog"."card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oracle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mana_cost" text,
	"mana_value" numeric(8, 2),
	"type_line" text,
	"oracle_text" text,
	"colors" text[],
	"color_identity" text[],
	"keywords" text[],
	"layout" text,
	"reserved" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_oracle_id_unique" UNIQUE("oracle_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."printing_identifier" (
	"printing_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "printing_identifier_printing_id_provider_external_id_pk" PRIMARY KEY("printing_id","provider","external_id"),
	CONSTRAINT "printing_identifier_provider_external_id_uidx" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."printing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"collector_number" text NOT NULL,
	"language" text,
	"rarity" text,
	"artist" text,
	"released_at" date,
	"border_color" text,
	"frame" text,
	"full_art" boolean,
	"textless" boolean,
	"oversized" boolean,
	"promo" boolean,
	"reprint" boolean,
	"image_small" text,
	"image_normal" text,
	"image_large" text,
	"image_png" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "printing_scryfall_id_unique" UNIQUE("scryfall_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scryfall_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"set_type" text,
	"released_at" date,
	"card_count" integer,
	"digital" boolean,
	"parent_set_code" text,
	"icon_svg_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "set_scryfall_id_unique" UNIQUE("scryfall_id"),
	CONSTRAINT "set_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "catalog"."card_face" ADD CONSTRAINT "card_face_printing_id_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "catalog"."printing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."printing_identifier" ADD CONSTRAINT "printing_identifier_printing_id_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "catalog"."printing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."printing" ADD CONSTRAINT "printing_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "catalog"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."printing" ADD CONSTRAINT "printing_set_id_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "catalog"."set"("id") ON DELETE restrict ON UPDATE no action;