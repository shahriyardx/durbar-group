CREATE TYPE "public"."user_role" AS ENUM('student', 'instructor', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."channel_key" AS ENUM('announcements', 'task', 'session', 'discussion', 'help', 'resources');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('scheduled', 'published', 'cancelled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"course_email" text,
	"student_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_course_email_unique" UNIQUE("course_email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"others" jsonb,
	"source_file" text,
	"imported_by" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"claimed_by_user_id" text,
	"claimed_at" timestamp,
	CONSTRAINT "imported_student_email_unique" UNIQUE("email"),
	CONSTRAINT "imported_student_claimed_by_user_id_unique" UNIQUE("claimed_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "instructor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"discord_category_id" text,
	"discord_instructor_role_id" text,
	"discord_student_role_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "instructor_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"key" "channel_key" NOT NULL,
	"discord_channel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_channel_key_uq" UNIQUE("instructor_id","key")
);
--> statement-breakpoint
CREATE TABLE "pending_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_email" text NOT NULL,
	"instructor_id" uuid NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_assignment_uq" UNIQUE("course_email","instructor_id")
);
--> statement-breakpoint
CREATE TABLE "student_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_user_id" text NOT NULL,
	"instructor_id" uuid NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"discord_synced_at" timestamp,
	CONSTRAINT "student_assignment_uq" UNIQUE("student_user_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"due_at" timestamp NOT NULL,
	"status" "task_status" DEFAULT 'scheduled' NOT NULL,
	"published_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"discord_channel_id" text,
	"discord_message_id" text,
	"posted_at" timestamp,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_post_uq" UNIQUE("task_id","instructor_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_student" ADD CONSTRAINT "imported_student_imported_by_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_student" ADD CONSTRAINT "imported_student_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor" ADD CONSTRAINT "instructor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor" ADD CONSTRAINT "instructor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_channel" ADD CONSTRAINT "instructor_channel_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_assignment" ADD CONSTRAINT "pending_assignment_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_assignment" ADD CONSTRAINT "pending_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assignment" ADD CONSTRAINT "student_assignment_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assignment" ADD CONSTRAINT "student_assignment_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assignment" ADD CONSTRAINT "student_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_post" ADD CONSTRAINT "task_post_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_post" ADD CONSTRAINT "task_post_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_assignment_instructor_idx" ON "student_assignment" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "task_starts_at_idx" ON "task" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "task_post_task_idx" ON "task_post" USING btree ("task_id");