CREATE TYPE "public"."hunt_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."hunt_trigger" AS ENUM('schedule', 'manual');--> statement-breakpoint
CREATE TABLE "hunt_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"trigger" "hunt_trigger" NOT NULL,
	"status" "hunt_run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"found" integer DEFAULT 0 NOT NULL,
	"already_tracked" integer DEFAULT 0 NOT NULL,
	"excluded" integer DEFAULT 0 NOT NULL,
	"tracked" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hunts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"run_hour" integer DEFAULT 7 NOT NULL,
	"max_new_per_run" integer DEFAULT 10 NOT NULL,
	"min_reviews" integer DEFAULT 0 NOT NULL,
	"include_no_website" boolean DEFAULT true NOT NULL,
	"auto_draft" boolean DEFAULT false NOT NULL,
	"auto_draft_min_priority" integer DEFAULT 50 NOT NULL,
	"last_scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_profile" ADD COLUMN "timezone" text DEFAULT 'Asia/Jakarta' NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_profile" ADD COLUMN "follow_up_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "hunt_id" uuid;--> statement-breakpoint
ALTER TABLE "hunt_runs" ADD CONSTRAINT "hunt_runs_hunt_id_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hunt_runs_hunt_id_idx" ON "hunt_runs" USING btree ("hunt_id","started_at");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_hunt_id_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."hunts"("id") ON DELETE set null ON UPDATE no action;