import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { ROLE_RANK } from "@/lib/rbac";
import {
  grantInstructorSpace,
  revokeInstructorSpace,
} from "@/server/instructors";

export type ActionResult = { ok: true; warning?: string } | { ok: false; error: string };

/** Roles only a super admin may hand out or take away. */
const PRIVILEGED: Role[] = ["admin", "super_admin"];

/**
 * Change a user's role, applying the Discord side effects that go with it.
 *
 * Guard rails: you cannot change your own role (that is how an instance ends
 * up with no admins), only a super admin can touch admin-level roles, and an
 * admin cannot act on someone ranked above them.
 */
export async function changeUserRole(
  actor: { id: string; role: string },
  targetUserId: string,
  nextRole: Role,
): Promise<ActionResult> {
  if (actor.id === targetUserId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const [target] = await db
    .select({ id: schema.user.id, role: schema.user.role, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, targetUserId))
    .limit(1);

  if (!target) return { ok: false, error: "That account no longer exists." };
  if (target.role === nextRole) return { ok: true };

  const actorRole = actor.role as Role;
  const isSuperAdmin = actorRole === "super_admin";

  if (!isSuperAdmin && PRIVILEGED.includes(nextRole)) {
    return { ok: false, error: "Only a super admin can grant admin access." };
  }
  if (!isSuperAdmin && PRIVILEGED.includes(target.role)) {
    return { ok: false, error: "Only a super admin can change another admin." };
  }
  if (ROLE_RANK[target.role] > ROLE_RANK[actorRole]) {
    return { ok: false, error: "You cannot act on an account above your own role." };
  }

  // Dropping a plain instructor to student takes their teaching space with
  // it. Promoting an instructor to admin does not: they keep teaching, and
  // the space is managed separately from the instructors page.
  if (target.role === "instructor" && nextRole === "student") {
    const [instructor] = await db
      .select({ id: schema.instructor.id })
      .from(schema.instructor)
      .where(eq(schema.instructor.userId, targetUserId))
      .limit(1);

    if (instructor) {
      const result = await revokeInstructorSpace(instructor.id);
      if (result.error) {
        // The database is already consistent; only Discord lagged.
        await setRoleRow(targetUserId, nextRole);
        return {
          ok: true,
          warning: `Role updated, but Discord cleanup failed: ${result.error}`,
        };
      }
      return { ok: true };
    }
  }

  if (nextRole === "instructor") {
    // grantInstructorSpace only lifts a student, so set the role explicitly
    // first — this branch can also be a demotion from admin.
    await setRoleRow(targetUserId, nextRole);
    const result = await grantInstructorSpace(targetUserId, actor.id);
    if (!result.ok) return { ok: false, error: result.error };
    return result.discordError
      ? {
          ok: true,
          warning: `Role changed, but Discord provisioning failed: ${result.discordError}. Retry it from the instructors page.`,
        }
      : { ok: true };
  }

  await setRoleRow(targetUserId, nextRole);
  return { ok: true };
}

async function setRoleRow(userId: string, role: Role) {
  await db
    .update(schema.user)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.user.id, userId));
}

export async function setUserBanned(
  actor: { id: string; role: string },
  targetUserId: string,
  banned: boolean,
): Promise<ActionResult> {
  if (actor.id === targetUserId) {
    return { ok: false, error: "You cannot ban your own account." };
  }

  const [target] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, targetUserId))
    .limit(1);

  if (!target) return { ok: false, error: "That account no longer exists." };

  const actorRole = actor.role as Role;
  if (actorRole !== "super_admin" && PRIVILEGED.includes(target.role)) {
    return { ok: false, error: "Only a super admin can ban an admin." };
  }

  await db
    .update(schema.user)
    .set({ banned, updatedAt: new Date() })
    .where(eq(schema.user.id, targetUserId));

  return { ok: true };
}
