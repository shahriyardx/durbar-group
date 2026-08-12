"use server";

import { revalidatePath } from "next/cache";

import type { Role } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { changeUserRole, setUserBanned } from "@/server/users";

const ROLES: Role[] = ["student", "instructor", "admin", "super_admin"];

export type UserActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function changeRoleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireRole("admin");

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!userId || !ROLES.includes(role)) {
    return { status: "error", message: "Invalid role change." };
  }

  const result = await changeUserRole(admin, userId, role);
  revalidatePath("/admin/users");
  revalidatePath("/admin/instructors");
  revalidatePath("/admin");

  if (!result.ok) return { status: "error", message: result.error };
  return {
    status: "success",
    message: result.warning ?? `Role changed to ${role.replace("_", " ")}.`,
  };
}

export async function toggleBanAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireRole("admin");

  const userId = String(formData.get("userId") ?? "");
  const banned = formData.get("banned") === "true";
  if (!userId) return { status: "error", message: "Missing account." };

  const result = await setUserBanned(admin, userId, banned);
  revalidatePath("/admin/users");

  if (!result.ok) return { status: "error", message: result.error };
  return {
    status: "success",
    message: banned ? "Account banned." : "Ban lifted.",
  };
}
