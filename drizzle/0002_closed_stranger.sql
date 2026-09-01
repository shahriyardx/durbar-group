ALTER TABLE "user" ADD COLUMN "eliminated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "elimination_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "eliminated_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "eliminated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_eliminated_by_user_id_fk" FOREIGN KEY ("eliminated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;