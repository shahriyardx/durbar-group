import {
  index,
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
 */
export const importedStudent = pgTable(
  "imported_student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always stored lowercased/trimmed so lookups are exact-match.
    email: text("email").notNull().unique(),
    name: text("name"),
    studentId: text("student_id"),
    batch: text("batch"),
    phone: text("phone"),
    // Any extra spreadsheet columns we did not model explicitly.
    extra: jsonb("extra").$type<Record<string, string>>(),
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
  },
  (t) => [index("imported_student_batch_idx").on(t.batch)],
);

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

export type ImportedStudent = typeof importedStudent.$inferSelect;
export type Instructor = typeof instructor.$inferSelect;
export type ChannelKey = (typeof channelKey.enumValues)[number];
