import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { getDiscordAccessToken, getDiscordUserId } from "@/lib/discord/account";
import {
  addGuildMember,
  addRoleToMember,
  isGuildMember,
  removeRoleFromMember,
} from "@/lib/discord/provision";

/** Why a student could not be put into the guild, in words they can act on. */
export const SYNC_FAILURE_BN: Record<
  Extract<SyncResult, { ok: false }>["reason"],
  string
> = {
  "no-discord-account":
    "তোমার ডিসকর্ড অ্যাকাউন্টের সঙ্গে সংযোগ পাওয়া যায়নি। সাইন আউট করে আবার ডিসকর্ড দিয়ে লগইন করো।",
  "no-access-token":
    "ডিসকর্ড লগইনের মেয়াদ শেষ হয়ে গেছে, তাই তোমাকে সার্ভারে যুক্ত করা যায়নি। সাইন আউট করে আবার ডিসকর্ড দিয়ে লগইন করো, তারপর আবার চেষ্টা করো।",
};

export type SyncResult =
  | { ok: true; joinedGuild: boolean; rolesApplied: number }
  | { ok: false; reason: "no-discord-account" | "no-access-token" };

/**
 * The Discord half of a sync, with the roles handed in rather than looked up.
 * Verification calls this from inside its transaction, where the assignments
 * it just created are not visible to a second connection yet.
 *
 * Returns a reason for the two cases the caller can explain to a user, and
 * throws for anything Discord itself rejected.
 */
export async function applyDiscordAccess(
  userId: string,
  roleIds: string[],
): Promise<SyncResult> {
  const discordUserId = await getDiscordUserId(userId);
  if (!discordUserId) return { ok: false, reason: "no-discord-account" };

  const alreadyMember = await isGuildMember(discordUserId);

  if (!alreadyMember) {
    // Joining requires the user's own OAuth token (guilds.join scope).
    const accessToken = await getDiscordAccessToken(userId);
    if (!accessToken) return { ok: false, reason: "no-access-token" };
    await addGuildMember(discordUserId, accessToken, roleIds);
  } else {
    // PUT /members on an existing member is a no-op for roles, so grant
    // them one by one.
    for (const roleId of roleIds) {
      await addRoleToMember(discordUserId, roleId);
    }
  }

  return { ok: true, joinedGuild: !alreadyMember, rolesApplied: roleIds.length };
}

/**
 * Push the student's current assignments onto their Discord member object:
 * join the guild if needed, then make sure they hold exactly the student
 * roles their assignments say they should.
 */
export async function syncStudentDiscordAccess(
  userId: string,
): Promise<SyncResult> {
  const rows = await db
    .select({
      assignmentId: schema.studentAssignment.id,
      studentRoleId: schema.instructor.discordStudentRoleId,
    })
    .from(schema.studentAssignment)
    .innerJoin(
      schema.instructor,
      eq(schema.studentAssignment.instructorId, schema.instructor.id),
    )
    .where(eq(schema.studentAssignment.studentUserId, userId));

  const roleIds = rows
    .map((r) => r.studentRoleId)
    .filter((id): id is string => Boolean(id));

  const result = await applyDiscordAccess(userId, roleIds);
  if (!result.ok) return result;

  const syncedIds = rows.map((r) => r.assignmentId);
  if (syncedIds.length > 0) {
    await db
      .update(schema.studentAssignment)
      .set({ discordSyncedAt: new Date() })
      .where(inArray(schema.studentAssignment.id, syncedIds));
  }

  return result;
}

/** Strip a single instructor's student role when an assignment is revoked. */
export async function revokeStudentDiscordAccess(
  userId: string,
  studentRoleId: string | null,
) {
  if (!studentRoleId) return;
  const discordUserId = await getDiscordUserId(userId);
  if (!discordUserId) return;
  await removeRoleFromMember(discordUserId, studentRoleId);
}
