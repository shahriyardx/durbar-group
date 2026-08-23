import "server-only";

import { eq, inArray, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { getDiscordUserId } from "@/lib/discord/account";
import { DiscordApiError } from "@/lib/discord/rest";
import { removeGuildMember } from "@/lib/discord/provision";
import {
  applyDiscordAccess,
  revokeStudentDiscordAccess,
  SYNC_FAILURE_BN,
} from "@/server/discord-sync";

export type ClaimResult =
  | { ok: true; assigned: boolean }
  | { ok: false; error: string };

/**
 * Thrown inside the claim transaction to roll it back. Verification is only
 * true once the student is actually in the Discord server, so a failure here
 * must undo the claim rather than leave them "verified" with no access.
 */
class DiscordJoinError extends Error {}

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

/**
 * The whole "are you actually a student" check: the address the user typed
 * must exist in the imported roster and must not already belong to another
 * account. Their Discord email is never consulted.
 */
export async function claimCourseEmail(
  userId: string,
  rawEmail: string,
): Promise<ClaimResult> {
  const email = normalizeEmail(rawEmail);

  const outcome = await db.transaction(async (tx) => {
    // Row lock so two accounts cannot claim the same roster entry.
    const [student] = await tx
      .select()
      .from(schema.importedStudent)
      .where(eq(schema.importedStudent.email, email))
      .limit(1)
      .for("update");

    if (!student) {
      return {
        ok: false as const,
        error:
          "এই ইমেইলটি স্টুডেন্ট লিস্টে পাওয়া যায়নি। কোর্সে এনরোল করা ইমেইলটি আবার দেখে লেখো, অথবা অ্যাডমিনের সাথে যোগাযোগ করো।",
      };
    }

    if (student.claimedByUserId && student.claimedByUserId !== userId) {
      return {
        ok: false as const,
        error:
          "এই ইমেইলটি আগেই অন্য একটি অ্যাকাউন্ট দিয়ে ভেরিফাই করা হয়েছে। এটি তোমার ইমেইল হলে অ্যাডমিনকে জানাও।",
      };
    }

    // No separate check on user.courseEmail: it can only have been taken by
    // whoever claimed this roster row, and that case is handled above.
    await tx
      .update(schema.importedStudent)
      .set({ claimedByUserId: userId, claimedAt: new Date() })
      .where(eq(schema.importedStudent.id, student.id));

    await tx
      .update(schema.user)
      .set({
        courseEmail: email,
        studentVerified: true,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    // Anything an admin pre-assigned to this email becomes a real assignment.
    const pending = await tx
      .select()
      .from(schema.pendingAssignment)
      .where(eq(schema.pendingAssignment.courseEmail, email));

    for (const row of pending) {
      await tx
        .insert(schema.studentAssignment)
        .values({
          studentUserId: userId,
          instructorId: row.instructorId,
          assignedBy: row.assignedBy,
        })
        .onConflictDoNothing();
    }

    if (pending.length > 0) {
      await tx
        .delete(schema.pendingAssignment)
        .where(eq(schema.pendingAssignment.courseEmail, email));
    }

    // Read the assignments back through `tx` — the rows above are not visible
    // to any other connection until this transaction commits.
    const assignments = await tx
      .select({
        id: schema.studentAssignment.id,
        studentRoleId: schema.instructor.discordStudentRoleId,
      })
      .from(schema.studentAssignment)
      .innerJoin(
        schema.instructor,
        eq(schema.studentAssignment.instructorId, schema.instructor.id),
      )
      .where(eq(schema.studentAssignment.studentUserId, userId));

    const roleIds = assignments
      .map((row) => row.studentRoleId)
      .filter((id): id is string => Boolean(id));

    // Discord is part of the deal, not an afterthought: if we cannot put them
    // in the server, throwing here rolls the claim back so they can retry.
    const sync = await applyDiscordAccess(userId, roleIds);
    if (!sync.ok) throw new DiscordJoinError(SYNC_FAILURE_BN[sync.reason]);

    if (assignments.length > 0) {
      await tx
        .update(schema.studentAssignment)
        .set({ discordSyncedAt: new Date() })
        .where(
          inArray(
            schema.studentAssignment.id,
            assignments.map((row) => row.id),
          ),
        );
    }

    return { ok: true as const, assigned: assignments.length > 0 };
  }).catch((error) => {
    // The student is shown something they can act on; the server keeps what
    // actually happened. Without this the generic message below is all anyone
    // ever sees, and a Discord 403 looks the same as a dead database.
    console.error(
      `[verify] claim failed for user=${userId} email=${email}:`,
      error instanceof DiscordApiError
        ? `Discord ${error.status} on ${error.path} — ${JSON.stringify(error.body)}`
        : error,
    );

    if (error instanceof DiscordJoinError) {
      return { ok: false as const, error: error.message };
    }
    return {
      ok: false as const,
      error:
        "ডিসকর্ড সার্ভারে যুক্ত করা যায়নি, তাই ভেরিফিকেশন সম্পূর্ণ হয়নি। একটু পরে আবার চেষ্টা করো — সমস্যা থাকলে অ্যাডমিনকে জানাও।",
    };
  });

  return outcome;
}

export type RevokeResult = {
  courseEmail: string | null;
  /** Assignments dropped, and the Discord roles that went with them. */
  assignmentsRemoved: number;
  /** True once they are out of the guild, not merely stripped of roles. */
  removedFromGuild: boolean;
  discordError?: string;
};

/**
 * Undo a verification so the student has to claim their course email again,
 * and put them out of the Discord server while we are at it.
 *
 * Their assignments go with it: an assignment is a statement about a verified
 * student, so leaving them behind would give an unverified account Discord
 * access. The imported row is released too, which is what lets the same email
 * be claimed again — by them or by whoever it really belongs to.
 */
export async function revokeVerification(
  userId: string,
): Promise<RevokeResult> {
  const [account] = await db
    .select({ courseEmail: schema.user.courseEmail })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  // Read the roles before dropping the rows that point at them.
  const assignments = await db
    .select({
      id: schema.studentAssignment.id,
      studentRoleId: schema.instructor.discordStudentRoleId,
    })
    .from(schema.studentAssignment)
    .innerJoin(
      schema.instructor,
      eq(schema.studentAssignment.instructorId, schema.instructor.id),
    )
    .where(eq(schema.studentAssignment.studentUserId, userId));

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.studentAssignment)
      .where(eq(schema.studentAssignment.studentUserId, userId));

    await tx
      .update(schema.importedStudent)
      .set({ claimedByUserId: null, claimedAt: null })
      .where(eq(schema.importedStudent.claimedByUserId, userId));

    await tx
      .update(schema.user)
      .set({
        courseEmail: null,
        studentVerified: false,
        verifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));
  });

  // Discord after the commit: a failure here leaves stale access an admin can
  // clear by hand, rather than an account that is still verified.
  const discordUserId = await getDiscordUserId(userId);
  let removedFromGuild = false;
  let discordError: string | undefined;

  if (discordUserId) {
    try {
      await removeGuildMember(discordUserId);
      removedFromGuild = true;
    } catch (error) {
      discordError =
        error instanceof Error ? error.message : "Discord call failed.";
      // Could not kick — usually a missing KICK_MEMBERS permission. Fall back
      // to stripping the roles so they at least lose every channel.
      for (const row of assignments) {
        try {
          await revokeStudentDiscordAccess(userId, row.studentRoleId);
        } catch {
          // Already reported through discordError above.
        }
      }
    }
  }

  return {
    courseEmail: account?.courseEmail ?? null,
    assignmentsRemoved: assignments.length,
    removedFromGuild,
    discordError,
  };
}

/** Roster rows nobody has claimed yet — useful for the admin overview. */
export function unclaimedRoster() {
  return db
    .select()
    .from(schema.importedStudent)
    .where(isNull(schema.importedStudent.claimedByUserId));
}
