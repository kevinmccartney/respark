-- Move app-owned tables out of public into the app schema (data-preserving).
ALTER TABLE "public"."users" SET SCHEMA "app";--> statement-breakpoint
ALTER TABLE "public"."decks" SET SCHEMA "app";
