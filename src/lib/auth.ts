import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { env } from "@/lib/env";

// Arbitrary but fixed key: serialises the "who is the first user" race.
const FIRST_USER_LOCK = 728_412_001;

/**
 * Promote the very first account on the database to super_admin.
 *
 * Two people hitting the Discord callback at the same moment would both see
 * an empty table under READ COMMITTED, so the check and the update run inside
 * one transaction behind a session-level advisory lock.
 */
async function promoteIfFirstUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_USER_LOCK})`);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.user)
      .where(sql`${schema.user.role} in ('admin', 'super_admin')`);

    if (count === 0) {
      await tx
        .update(schema.user)
        .set({ role: "super_admin", updatedAt: new Date() })
        .where(sql`${schema.user.id} = ${userId}`);
    }
  });
}

export const auth = betterAuth({
  appName: "Durbar",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Discord is the only way in. No email/password, ever.
  emailAndPassword: { enabled: false },
  socialProviders: {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      // guilds.join lets us drop a verified student straight into the server
      // with the bot token, no invite link round-trip.
      scope: ["identify", "email", "guilds.join"],
      // better-auth sends prompt=none by default, and Discord reads that as
      // "reuse the existing authorisation" — handing back a token with the
      // scopes granted the *first* time. Anyone who signed in before
      // guilds.join was asked for kept a token without it, and no amount of
      // signing out fixed that, because there was never a second consent
      // screen. This costs one click per sign-in and guarantees the scope.
      prompt: "consent",
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "student", input: false },
      courseEmail: { type: "string", required: false, input: false },
      studentVerified: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
      verifiedAt: { type: "date", required: false, input: false },
      banned: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
      // Carried on the session user so every guard can bounce an eliminated
      // student without a second query. The reason is not: only the page
      // that shows it needs that, and it is a paragraph of Bengali prose.
      eliminated: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Deliberately off: the cookie cache freezes role/studentVerified into a
    // signed cookie, so a promotion (or a demotion, or a ban) would not take
    // effect until it expired. Every guard reads the live row instead.
    cookieCache: { enabled: false },
  },
  // Anything that blows up inside better-auth lands on our own page with the
  // reason in the query string, instead of Discord's opaque default.
  onAPIError: { errorURL: "/error" },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await promoteIfFirstUser(createdUser.id);
        },
      },
    },
  },
  // nextCookies must stay last so it can flush Set-Cookie from server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
