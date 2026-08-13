import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Roster imported from the admin's Excel file. Deliberately NOT the users
 * table: a row here only answers "is this course email a real student?".
 * It holds no Discord state and no instructor link — assignment happens
 * later, against the user account that claimed the row.
 *
 * Only name, email and phone are modelled as columns. Every other column in
 * the spreadsheet is kept verbatim in `others` as `{ "Header": "cell" }`, so
 * nothing an admin uploads is ever thrown away.
 */
export const importedStudent = pgTable("imported_student", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Always stored lowercased/trimmed so lookups are exact-match.
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  others: jsonb("others").$type<Record<string, string>>(),
  sourceFile: text("source_file"),
  importedBy: text("imported_by").references(() => user.id, {
    onDelete: "set null",
  }),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  // Set when a logged-in user proves ownership of this email.
  claimedByUserId: text("claimed_by_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at"),
});

/**
 * One row per user promoted to instructor, holding the Discord objects
 * provisioned for them. Roles (not per-user overwrites) carry access, so
 * a category never runs into the ~500 permission-overwrite ceiling.
 */
export const instructor = pgTable("instructor", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  discordCategoryId: text("discord_category_id"),
  // Full access to this instructor's category only.
  discordInstructorRoleId: text("discord_instructor_role_id"),
  // Read-only everywhere except discussion/help.
  discordStudentRoleId: text("discord_student_role_id"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelKey = pgEnum("channel_key", [
  "announcements",
  "task",
  "session",
  "discussion",
  "help",
  "resources",
]);

export const instructorChannel = pgTable(
  "instructor_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => instructor.id, { onDelete: "cascade" }),
    key: channelKey("key").notNull(),
    discordChannelId: text("discord_channel_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("instructor_channel_key_uq").on(t.instructorId, t.key)],
);

/**
 * Admin pastes a list of course emails; each resolved student *account*
 * lands here. FK is on user.id, not email, per spec.
 */
export const studentAssignment = pgTable(
  "student_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => instructor.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    // Null until the Discord student role is actually on the member.
    discordSyncedAt: timestamp("discord_synced_at"),
  },
  (t) => [
    unique("student_assignment_uq").on(t.studentUserId, t.instructorId),
    index("student_assignment_instructor_idx").on(t.instructorId),
  ],
);

/**
 * Emails an admin pasted that matched no student account yet. Kept so the
 * grant can be applied the moment that student verifies.
 */
export const pendingAssignment = pgTable(
  "pending_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseEmail: text("course_email").notNull(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => instructor.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("pending_assignment_uq").on(t.courseEmail, t.instructorId)],
);

export const taskStatus = pgEnum("task_status", [
  "scheduled",
  "published",
  "cancelled",
]);

/**
 * A task an admin writes once and Durbar fans out to every instructor's
 * #task channel. `body` is stored as the exact Discord-flavoured markdown
 * that will be posted, so what an admin previews is what Discord renders.
 */
export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Optional in the form; the server falls back to the creation time.
    startsAt: timestamp("starts_at").notNull(),
    dueAt: timestamp("due_at").notNull(),
    status: taskStatus("status").notNull().default("scheduled"),
    // Set once the fan-out has reached every instructor.
    publishedAt: timestamp("published_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("task_starts_at_idx").on(t.startsAt)],
);

/**
 * One row per (task, instructor) delivery. Doubles as the idempotency key:
 * a row with `postedAt` set is never posted again, and a row with `error`
 * set is what the admin screen shows as "failed, retry".
 */
export const taskPost = pgTable(
  "task_post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => instructor.id, { onDelete: "cascade" }),
    discordChannelId: text("discord_channel_id"),
    discordMessageId: text("discord_message_id"),
    postedAt: timestamp("posted_at"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("task_post_uq").on(t.taskId, t.instructorId),
    index("task_post_task_idx").on(t.taskId),
  ],
);

export type ImportedStudent = typeof importedStudent.$inferSelect;
export type Instructor = typeof instructor.$inferSelect;
export type ChannelKey = (typeof channelKey.enumValues)[number];
export type Task = typeof task.$inferSelect;
export type TaskPost = typeof taskPost.$inferSelect;
export type TaskStatus = (typeof taskStatus.enumValues)[number];
