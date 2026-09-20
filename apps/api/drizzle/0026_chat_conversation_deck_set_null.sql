ALTER TABLE "app"."chat_conversation" DROP CONSTRAINT "chat_conversation_deck_id_decks_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."chat_conversation" ADD CONSTRAINT "chat_conversation_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "app"."decks"("id") ON DELETE set null ON UPDATE no action;