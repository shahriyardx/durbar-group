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

export type SyncResult =
  | { ok: true; joinedGuild: boolean; rolesApplied: number }
  | { ok: false; reason: "no-discord-account" | "no-access-token" };

/**
 * Push the student's current assignments onto their Discord member object:
 * join the guild if needed, then make sure they hold exactly the student
 * roles their assignments say they should.
 */
export async function syncStudentDiscordAccess(
  userId: string,
): Promise<SyncResult> {
  const discordUserId = await getDiscordUserId(userId);
  if (!discordUserId) return { ok: false, reason: "no-discord-account" };

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

  const syncedIds = rows.map((r) => r.assignmentId);
  if (syncedIds.length > 0) {
    await db
      .update(schema.studentAssignment)
      .set({ discordSyncedAt: new Date() })
      .where(inArray(schema.studentAssignment.id, syncedIds));
  }

  return { ok: true, joinedGuild: !alreadyMember, rolesApplied: roleIds.length };
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
