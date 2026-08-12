import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Role } from "@/db/schema";
import { auth, type SessionUser } from "@/lib/auth";

export const ROLE_RANK: Record<Role, number> = {
  student: 0,
  instructor: 1,
  admin: 2,
  super_admin: 3,
};

export function hasRole(role: string, minimum: Role) {
  return (ROLE_RANK[role as Role] ?? -1) >= ROLE_RANK[minimum];
}

/** Deduped per request, so several guards in one render hit the DB once. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.banned) redirect("/error?error=account_banned");
  return user;
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, minimum)) redirect(homeFor(user.role as Role));
  return user;
}

/**
 * A student who has not proved their course email yet can only reach the
 * verification form; everything student-facing goes through this.
 */
export async function requireVerifiedStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.studentVerified && !hasRole(user.role, "instructor")) {
    redirect("/verify");
  }
  return user;
}

/**
 * The instructor row is what makes somebody a teacher, not the role enum —
 * an admin can run a course without giving up admin rights. Cached so the
 * shell and the page it renders share one query.
 */
export const getTeachingSpace = cache(async (userId: string) => {
  const { getInstructorByUserId } = await import("@/server/instructor-view");
  return getInstructorByUserId(userId);
});

/**
 * Guard for the instructor screens. Returns a null space for somebody who
 * holds the role but has not been provisioned yet, so the page can explain
 * that rather than bouncing them into a redirect loop.
 */
export async function requireTeachingSpace() {
  const user = await requireUser();
  const instructor = await getTeachingSpace(user.id);

  if (!instructor && !hasRole(user.role, "instructor")) {
    redirect(homeFor(user.role as Role));
  }

  return { user, instructor };
}

export function homeFor(role: Role) {
  if (hasRole(role, "admin")) return "/admin";
  if (role === "instructor") return "/instructor";
  return "/student";
}
