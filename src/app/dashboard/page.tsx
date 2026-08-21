import { redirect } from "next/navigation";

import type { Role } from "@/db/schema";
import { hasRole, homeFor, requireUser } from "@/lib/rbac";

/**
 * One stable address for "wherever I belong". Sign-in returns here, and the
 * landing page links here, so neither has to know anything about roles — and
 * `/` is free to stay the public page even for somebody signed in.
 */
export default async function DashboardPage() {
  const user = await requireUser();

  if (!user.studentVerified && !hasRole(user.role, "instructor")) {
    redirect("/verify");
  }
  redirect(homeFor(user.role as Role));
}
