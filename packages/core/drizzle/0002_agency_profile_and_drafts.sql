CREATE TYPE "public"."draft_channel" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TABLE "agency_profile" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"agency_name" text DEFAULT '' NOT NULL,
	"sender_name" text DEFAULT '' NOT NULL,
	"services" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT 'friendly and professional' NOT NULL,
	"language" text DEFAULT 'id' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"audit_id" uuid,
	"channel" "draft_channel" NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"warnings" text[] DEFAULT '{}' NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_business_id_idx" ON "drafts" USING btree ("business_id");