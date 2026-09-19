-- Card search: trigram indexes for ILIKE '%…%' and keyset pagination support.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE OR REPLACE FUNCTION catalog.immutable_array_to_string(arr text[], sep text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT array_to_string(arr, sep)
$$;--> statement-breakpoint
CREATE INDEX "card_name_id_idx" ON "catalog"."card" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "card_name_trgm_idx" ON "catalog"."card" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_type_line_trgm_idx" ON "catalog"."card" USING gin ("type_line" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_oracle_text_trgm_idx" ON "catalog"."card" USING gin ("oracle_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_mana_cost_trgm_idx" ON "catalog"."card" USING gin ("mana_cost" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_keywords_trgm_idx" ON "catalog"."card" USING gin (catalog.immutable_array_to_string("keywords", ' ') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_face_name_trgm_idx" ON "catalog"."card_face" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_face_type_line_trgm_idx" ON "catalog"."card_face" USING gin ("type_line" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_face_oracle_text_trgm_idx" ON "catalog"."card_face" USING gin ("oracle_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "printing_card_id_idx" ON "catalog"."printing" USING btree ("card_id");
