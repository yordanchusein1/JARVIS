CREATE TYPE "public"."lead_feedback" AS ENUM('good', 'bad');--> statement-breakpoint
ALTER TABLE "agency_profile" ADD COLUMN "scoring_weights" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "feedback" "lead_feedback";