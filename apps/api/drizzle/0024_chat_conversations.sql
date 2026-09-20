CREATE TABLE "app"."chat_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"tool_name" text,
	"tool_call_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."chat_conversation" ADD CONSTRAINT "chat_conversation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."chat_conversation" ADD CONSTRAINT "chat_conversation_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "app"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."chat_message" ADD CONSTRAINT "chat_message_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversation_user_id_deck_id_idx" ON "app"."chat_conversation" USING btree ("user_id","deck_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_user_id_updated_at_idx" ON "app"."chat_conversation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "app"."chat_message" USING btree ("conversation_id","created_at");