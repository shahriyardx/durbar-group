import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Roles are hierarchical: super_admin > admin > instructor > student.
 * The very first account created on a fresh database is promoted to
 * super_admin (see the databaseHooks in src/lib/auth.ts).
 */
export const userRole = pgEnum("user_role", [
  "student",
  "instructor",
  "admin",
  "super_admin",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Email that came back from Discord. Never used to decide whether somebody
  // is a student — the course email below does that.
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: userRole("role").default("student").notNull(),
  // Email the user typed into the verification form, matched against
  // imported_student.email. Null until they submit the form.
  courseEmail: text("course_email").unique(),
  // True once courseEmail matched a row in imported_student.
  studentVerified: boolean("student_verified").default(false).notNull(),
  verifiedAt: timestamp("verified_at"),
  banned: boolean("banned").default(false).notNull(),
  /**
   * Eliminated from the Durbar Group for failing the criteria. Distinct from
   * `banned`: the account and every trace of it stay on the admin screens on
   * purpose — an elimination is a record, not a deletion. What it costs them
   * is Discord, the dashboard and the ability to get back in.
   */
  eliminated: boolean("eliminated").default(false).notNull(),
  // Shown to the student verbatim when they try to sign in, so it is written
  // for them to read, not as an internal note.
  eliminationReason: text("elimination_reason"),
  eliminatedAt: timestamp("eliminated_at"),
  eliminatedBy: text("eliminated_by").references((): AnyPgColumn => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  // For the Discord provider this is the Discord snowflake user id.
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof user.$inferSelect;
export type Role = (typeof userRole.enumValues)[number];
