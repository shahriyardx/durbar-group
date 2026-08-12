import "server-only";

import { eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { syncStudentDiscordAccess } from "@/server/discord-sync";

export type ClaimResult =
  | { ok: true; discordSynced: boolean }
  | { ok: false; error: string };

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

    return { ok: true as const };
  });

  if (!outcome.ok) return outcome;

  // Discord work happens after the transaction commits: a Discord outage must
  // not roll back a verification that is already true in our database.
  const sync = await syncStudentDiscordAccess(userId);
  return { ok: true, discordSynced: sync.ok };
}

/** Roster rows nobody has claimed yet — useful for the admin overview. */
export function unclaimedRoster() {
  return db
    .select()
    .from(schema.importedStudent)
    .where(isNull(schema.importedStudent.claimedByUserId));
}
