import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { getDiscordUserId } from "@/lib/discord/account";
import {
  addRoleToMember,
  deprovisionInstructorSpace,
  provisionInstructorSpace,
  removeRoleFromMember,
} from "@/lib/discord/provision";
import {
  revokeStudentDiscordAccess,
  syncStudentDiscordAccess,
} from "@/server/discord-sync";
import { normalizeEmail } from "@/server/verification";

export type PromoteResult =
  | { ok: true; instructorId: string; discordError?: string }
  | { ok: false; error: string };

/**
 * Give a user their own Discord teaching space.
 *
 * Teaching is a separate thing from the role enum: the space is the row in
 * `instructor`, so an admin or super admin can run a course without giving up
 * their admin rights. Only a plain student is bumped up to the instructor
 * role here; anybody already ranked higher keeps the role they have.
 *
 * The database change and the Discord calls are deliberately separate: if
 * Discord fails, the instructor row still exists with null Discord ids and the
 * admin can retry provisioning, rather than the whole promotion vanishing.
 */
export async function grantInstructorSpace(
  targetUserId: string,
  adminId: string,
  displayNameInput?: string,
): Promise<PromoteResult> {
  const [target] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, targetUserId))
    .limit(1);

  if (!target) return { ok: false, error: "That account no longer exists." };

  const displayName = (displayNameInput || target.name || "Instructor").trim();

  const instructorId = await db.transaction(async (tx) => {
    // A student becomes an instructor; an admin stays an admin who teaches.
    if (target.role === "student") {
      await tx
        .update(schema.user)
        .set({ role: "instructor", updatedAt: new Date() })
        .where(eq(schema.user.id, targetUserId));
    }

    const [row] = await tx
      .insert(schema.instructor)
      .values({ userId: targetUserId, displayName, createdBy: adminId })
      .onConflictDoNothing({ target: schema.instructor.userId })
      .returning({ id: schema.instructor.id });

    if (row) return row.id;

    const [existing] = await tx
      .select({ id: schema.instructor.id })
      .from(schema.instructor)
      .where(eq(schema.instructor.userId, targetUserId))
      .limit(1);
    return existing.id;
  });

  const discordError = await provisionSpaceFor(instructorId);
  return { ok: true, instructorId, discordError };
}

/**
 * Create (or re-create) the Discord category, roles and channels for an
 * instructor. Returns an error string instead of throwing so the caller can
 * surface it and offer a retry. Safe to call again after a failure.
 */
export async function provisionSpaceFor(
  instructorId: string,
): Promise<string | undefined> {
  const [instructor] = await db
    .select()
    .from(schema.instructor)
    .where(eq(schema.instructor.id, instructorId))
    .limit(1);

  if (!instructor) return "Instructor record not found.";
  if (instructor.discordCategoryId) return undefined; // already provisioned

  try {
    const space = await provisionInstructorSpace(instructor.displayName);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.instructor)
        .set({
          discordCategoryId: space.categoryId,
          discordInstructorRoleId: space.instructorRoleId,
          discordStudentRoleId: space.studentRoleId,
          updatedAt: new Date(),
        })
        .where(eq(schema.instructor.id, instructorId));

      await tx
        .insert(schema.instructorChannel)
        .values(
          space.channels.map((channel) => ({
            instructorId,
            key: channel.key,
            discordChannelId: channel.channelId,
          })),
        )
        .onConflictDoNothing();
    });

    // Give the instructor their own role if they are already in the guild.
    const discordUserId = await getDiscordUserId(instructor.userId);
    if (discordUserId) {
      try {
        await addRoleToMember(
          discordUserId,
          space.instructorRoleId,
          "Instructor promoted in Durbar",
        );
      } catch {
        // They are not in the guild yet; the role lands when they join.
      }
    }

    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Discord call failed.";
  }
}

/**
 * Tear the Discord space down and remove the instructor row. The role only
 * drops back to student when the account was a plain instructor — an admin
 * who was teaching stays an admin.
 */
export async function revokeInstructorSpace(
  instructorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [instructor] = await db
    .select()
    .from(schema.instructor)
    .where(eq(schema.instructor.id, instructorId))
    .limit(1);

  if (!instructor) return { ok: false, error: "Instructor not found." };

  const channels = await db
    .select({ id: schema.instructorChannel.discordChannelId })
    .from(schema.instructorChannel)
    .where(eq(schema.instructorChannel.instructorId, instructorId));

  let error: string | undefined;
  try {
    await deprovisionInstructorSpace({
      categoryId: instructor.discordCategoryId,
      instructorRoleId: instructor.discordInstructorRoleId,
      studentRoleId: instructor.discordStudentRoleId,
      channelIds: channels.map((c) => c.id),
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Discord teardown failed.";
  }

  const [owner] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, instructor.userId))
    .limit(1);

  await db.transaction(async (tx) => {
    // Assignments and channels cascade from the instructor row.
    await tx
      .delete(schema.instructor)
      .where(eq(schema.instructor.id, instructorId));

    if (owner?.role === "instructor") {
      await tx
        .update(schema.user)
        .set({ role: "student", updatedAt: new Date() })
        .where(eq(schema.user.id, instructor.userId));
    }
  });

  return { ok: true, error };
}

export type AssignSummary = {
  assigned: string[];
  alreadyAssigned: string[];
  pending: string[];
  notOnRoster: string[];
  discordFailures: string[];
};

/** Split a pasted blob into unique, normalised email addresses. */
export function parseEmailList(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((part) => normalizeEmail(part))
    .filter((part) => part.includes("@"));
  return [...new Set(parts)];
}

/**
 * Assign a batch of course emails to one instructor.
 *
 * An email that belongs to a verified account becomes a real assignment; one
 * that is on the roster but not yet verified is parked in pending_assignment
 * and applied the moment that student verifies.
 */
export async function assignStudentsByEmail(
  instructorId: string,
  rawEmails: string,
  adminId: string,
): Promise<AssignSummary | { error: string }> {
  const emails = parseEmailList(rawEmails);
  if (emails.length === 0) return { error: "No email addresses found." };

  const [instructor] = await db
    .select({ id: schema.instructor.id })
    .from(schema.instructor)
    .where(eq(schema.instructor.id, instructorId))
    .limit(1);
  if (!instructor) return { error: "Instructor not found." };

  const summary: AssignSummary = {
    assigned: [],
    alreadyAssigned: [],
    pending: [],
    notOnRoster: [],
    discordFailures: [],
  };

  const roster = await db
    .select({ email: schema.importedStudent.email })
    .from(schema.importedStudent)
    .where(inArray(schema.importedStudent.email, emails));
  const onRoster = new Set(roster.map((r) => r.email));

  const accounts = await db
    .select({ id: schema.user.id, courseEmail: schema.user.courseEmail })
    .from(schema.user)
    .where(inArray(schema.user.courseEmail, emails));
  const accountByEmail = new Map(
    accounts
      .filter((a): a is { id: string; courseEmail: string } => !!a.courseEmail)
      .map((a) => [a.courseEmail, a.id]),
  );

  const existing = await db
    .select({ studentUserId: schema.studentAssignment.studentUserId })
    .from(schema.studentAssignment)
    .where(
      and(
        eq(schema.studentAssignment.instructorId, instructorId),
        inArray(
          schema.studentAssignment.studentUserId,
          accounts.length > 0 ? accounts.map((a) => a.id) : [""],
        ),
      ),
    );
  const alreadyAssigned = new Set(existing.map((e) => e.studentUserId));

  const toSync: string[] = [];

  for (const email of emails) {
    if (!onRoster.has(email)) {
      summary.notOnRoster.push(email);
      continue;
    }

    const userId = accountByEmail.get(email);

    if (!userId) {
      await db
        .insert(schema.pendingAssignment)
        .values({ courseEmail: email, instructorId, assignedBy: adminId })
        .onConflictDoNothing();
      summary.pending.push(email);
      continue;
    }

    if (alreadyAssigned.has(userId)) {
      summary.alreadyAssigned.push(email);
      continue;
    }

    await db
      .insert(schema.studentAssignment)
      .values({ studentUserId: userId, instructorId, assignedBy: adminId })
      .onConflictDoNothing();
    summary.assigned.push(email);
    toSync.push(userId);
  }

  // Discord roles go on after the rows exist, so a Discord hiccup never
  // leaves an assignment unrecorded.
  for (const userId of toSync) {
    try {
      const result = await syncStudentDiscordAccess(userId);
      if (!result.ok) {
        const email = accounts.find((a) => a.id === userId)?.courseEmail;
        if (email) summary.discordFailures.push(email);
      }
    } catch (error) {
      const email = accounts.find((a) => a.id === userId)?.courseEmail;
      // The admin only sees the email in "Discord sync failed"; the reason is
      // worth having somewhere.
      console.error(`[assign] Discord sync failed for ${email ?? userId}:`, error);
      if (email) summary.discordFailures.push(email);
    }
  }

  return summary;
}

/** Withdraw an email that was assigned before that student ever verified. */
export async function removePendingAssignment(
  courseEmail: string,
  instructorId: string,
) {
  await db
    .delete(schema.pendingAssignment)
    .where(
      and(
        eq(schema.pendingAssignment.courseEmail, normalizeEmail(courseEmail)),
        eq(schema.pendingAssignment.instructorId, instructorId),
      ),
    );
}

/** Drop a single assignment and take the Discord role back off. */
export async function unassignStudent(
  studentUserId: string,
  instructorId: string,
) {
  const [instructor] = await db
    .select({ studentRoleId: schema.instructor.discordStudentRoleId })
    .from(schema.instructor)
    .where(eq(schema.instructor.id, instructorId))
    .limit(1);

  await db
    .delete(schema.studentAssignment)
    .where(
      and(
        eq(schema.studentAssignment.studentUserId, studentUserId),
        eq(schema.studentAssignment.instructorId, instructorId),
      ),
    );

  if (instructor?.studentRoleId) {
    await revokeStudentDiscordAccess(studentUserId, instructor.studentRoleId);
  }
}

export type TransferResult =
  | { ok: true; discordMoved: boolean; discordError?: string }
  | { ok: false; error: string };

/**
 * Move a student from one instructor to another.
 *
 * Only a claimed row has a Discord side to move: the student is a real member
 * holding the old instructor's student role. For an email that nobody has
 * verified with yet there is nothing on Discord to touch, so the transfer is
 * the row update and nothing else — see `transferPendingAssignment`.
 */
export async function transferStudent(
  studentUserId: string,
  fromInstructorId: string,
  toInstructorId: string,
  adminId: string,
): Promise<TransferResult> {
  if (fromInstructorId === toInstructorId) {
    return { ok: false, error: "That is the instructor they are already with." };
  }

  const instructors = await db
    .select({
      id: schema.instructor.id,
      displayName: schema.instructor.displayName,
      studentRoleId: schema.instructor.discordStudentRoleId,
    })
    .from(schema.instructor)
    .where(inArray(schema.instructor.id, [fromInstructorId, toInstructorId]));

  const from = instructors.find((row) => row.id === fromInstructorId);
  const to = instructors.find((row) => row.id === toInstructorId);
  if (!from || !to) return { ok: false, error: "That instructor is gone." };

  const [existing] = await db
    .select({ id: schema.studentAssignment.id })
    .from(schema.studentAssignment)
    .where(
      and(
        eq(schema.studentAssignment.studentUserId, studentUserId),
        eq(schema.studentAssignment.instructorId, fromInstructorId),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "They are not assigned to that instructor." };
  }

  const [alreadyThere] = await db
    .select({ id: schema.studentAssignment.id })
    .from(schema.studentAssignment)
    .where(
      and(
        eq(schema.studentAssignment.studentUserId, studentUserId),
        eq(schema.studentAssignment.instructorId, toInstructorId),
      ),
    )
    .limit(1);

  if (alreadyThere) {
    // Assigned to both already: the transfer collapses to dropping the old one.
    await db
      .delete(schema.studentAssignment)
      .where(eq(schema.studentAssignment.id, existing.id));
  } else {
    await db
      .update(schema.studentAssignment)
      .set({
        instructorId: toInstructorId,
        assignedBy: adminId,
        assignedAt: new Date(),
        // Not synced until the roles below actually land.
        discordSyncedAt: null,
      })
      .where(eq(schema.studentAssignment.id, existing.id));
  }

  const discordUserId = await getDiscordUserId(studentUserId);
  if (!discordUserId) return { ok: true, discordMoved: false };

  try {
    // Add before removing, so they are never locked out mid-transfer.
    if (to.studentRoleId) {
      await addRoleToMember(
        discordUserId,
        to.studentRoleId,
        `Transferred to ${to.displayName} in Durbar`,
      );
    }
    if (from.studentRoleId) {
      await removeRoleFromMember(
        discordUserId,
        from.studentRoleId,
        `Transferred away from ${from.displayName} in Durbar`,
      );
    }
  } catch (error) {
    return {
      ok: true,
      discordMoved: false,
      discordError:
        error instanceof Error ? error.message : "Discord call failed.",
    };
  }

  if (!alreadyThere) {
    await db
      .update(schema.studentAssignment)
      .set({ discordSyncedAt: new Date() })
      .where(eq(schema.studentAssignment.id, existing.id));
  }

  return { ok: true, discordMoved: true };
}

/**
 * Move an email that was assigned before anybody verified with it. Nothing
 * exists on Discord for it yet, so this really is only a row update.
 */
export async function transferPendingAssignment(
  courseEmail: string,
  fromInstructorId: string,
  toInstructorId: string,
  adminId: string,
): Promise<TransferResult> {
  if (fromInstructorId === toInstructorId) {
    return { ok: false, error: "That is the instructor they are already with." };
  }

  const email = normalizeEmail(courseEmail);

  // Already parked against the target: keep that one and drop this.
  const [alreadyThere] = await db
    .select({ id: schema.pendingAssignment.id })
    .from(schema.pendingAssignment)
    .where(
      and(
        eq(schema.pendingAssignment.courseEmail, email),
        eq(schema.pendingAssignment.instructorId, toInstructorId),
      ),
    )
    .limit(1);

  if (alreadyThere) {
    await db
      .delete(schema.pendingAssignment)
      .where(
        and(
          eq(schema.pendingAssignment.courseEmail, email),
          eq(schema.pendingAssignment.instructorId, fromInstructorId),
        ),
      );
    return { ok: true, discordMoved: false };
  }

  const updated = await db
    .update(schema.pendingAssignment)
    .set({ instructorId: toInstructorId, assignedBy: adminId })
    .where(
      and(
        eq(schema.pendingAssignment.courseEmail, email),
        eq(schema.pendingAssignment.instructorId, fromInstructorId),
      ),
    )
    .returning({ id: schema.pendingAssignment.id });

  if (updated.length === 0) {
    return { ok: false, error: "That email is not pending for this instructor." };
  }

  return { ok: true, discordMoved: false };
}

/** Every instructor an admin could transfer somebody to. */
export async function listInstructorOptions() {
  return db
    .select({
      id: schema.instructor.id,
      displayName: schema.instructor.displayName,
    })
    .from(schema.instructor)
    .orderBy(asc(schema.instructor.displayName));
}
