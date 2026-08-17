"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/rbac";
import { syncStudentDiscordAccess } from "@/server/discord-sync";
import {
  assignStudentsByEmail,
  grantInstructorSpace,
  provisionSpaceFor,
  removePendingAssignment,
  revokeInstructorSpace,
  transferPendingAssignment,
  transferStudent,
  unassignStudent,
  type AssignSummary,
} from "@/server/instructors";

function refresh() {
  revalidatePath("/admin/instructors", "layout");
  revalidatePath("/admin");
}

export type SimpleState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function promoteUserAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const admin = await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { status: "error", message: "Pick an account first." };

  // Granting a teaching space is additive — an admin who takes a course keeps
  // their admin rights; only a student is lifted to the instructor role.
  const result = await grantInstructorSpace(userId, admin.id);
  refresh();

  if (!result.ok) return { status: "error", message: result.error };
  return result.discordError
    ? {
        status: "error",
        message: `Instructor created, but Discord provisioning failed: ${result.discordError}`,
      }
    : { status: "success", message: "Instructor space provisioned." };
}

export async function retryProvisionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!instructorId) return { status: "error", message: "Missing instructor." };

  const error = await provisionSpaceFor(instructorId);
  refresh();

  return error
    ? { status: "error", message: error }
    : { status: "success", message: "Discord space provisioned." };
}

export async function revokeInstructorAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!instructorId) return { status: "error", message: "Missing instructor." };

  const result = await revokeInstructorSpace(instructorId);
  refresh();

  if (!result.ok) return { status: "error", message: result.error ?? "Failed." };
  return result.error
    ? {
        status: "error",
        message: `Space removed, but Discord cleanup failed: ${result.error}`,
      }
    : {
        status: "success",
        message: "Teaching space removed.",
      };
}

export async function unassignStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!studentUserId || !instructorId) {
    return { status: "error", message: "Missing student." };
  }

  try {
    await unassignStudent(studentUserId, instructorId);
  } catch (error) {
    refresh();
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Unassigned, but Discord role removal failed: ${error.message}`
          : "Discord role removal failed.",
    };
  }

  refresh();
  return { status: "success", message: "Student unassigned." };
}

export async function removePendingAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const courseEmail = String(formData.get("courseEmail") ?? "");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!courseEmail || !instructorId) {
    return { status: "error", message: "Missing email." };
  }

  await removePendingAssignment(courseEmail, instructorId);
  refresh();
  return { status: "success", message: `${courseEmail} withdrawn.` };
}

export async function resyncStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  if (!studentUserId) return { status: "error", message: "Missing student." };

  try {
    const result = await syncStudentDiscordAccess(studentUserId);
    refresh();

    if (result.ok) {
      return {
        status: "success",
        message: result.joinedGuild
          ? "Added to the server and roles applied."
          : `Roles re-applied (${result.rolesApplied}).`,
      };
    }

    return {
      status: "error",
      message:
        result.reason === "no-discord-account"
          ? "That account has no linked Discord login."
          : "Their Discord token expired — they need to sign in again before they can be added to the server.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Discord call failed.",
    };
  }
}

export async function transferStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const admin = await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  const courseEmail = String(formData.get("courseEmail") ?? "");
  const fromInstructorId = String(formData.get("fromInstructorId") ?? "");
  const toInstructorId = String(formData.get("toInstructorId") ?? "");

  if (!fromInstructorId || !toInstructorId) {
    return { status: "error", message: "Pick an instructor to move them to." };
  }

  // A claimed account has Discord roles to move; a pending email does not.
  const result = studentUserId
    ? await transferStudent(
        studentUserId,
        fromInstructorId,
        toInstructorId,
        admin.id,
      )
    : await transferPendingAssignment(
        courseEmail,
        fromInstructorId,
        toInstructorId,
        admin.id,
      );

  refresh();
  if (!result.ok) return { status: "error", message: result.error };

  if (result.discordError) {
    return {
      status: "error",
      message: `Transferred, but Discord roles did not move: ${result.discordError}`,
    };
  }
  return {
    status: "success",
    message: result.discordMoved
      ? "Transferred, and their Discord access moved with them."
      : studentUserId
        ? "Transferred. They have no Discord account linked, so nothing moved there."
        : "Transferred. Nothing to move on Discord until they verify.",
  };
}

export type AssignState = {
  status: "idle" | "error" | "success";
  message?: string;
  summary?: AssignSummary;
};

export async function assignStudentsAction(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const admin = await requireRole("admin");
  const instructorId = String(formData.get("instructorId") ?? "");
  const emails = String(formData.get("emails") ?? "");

  if (!instructorId) return { status: "error", message: "Missing instructor." };

  const result = await assignStudentsByEmail(instructorId, emails, admin.id);
  if ("error" in result) return { status: "error", message: result.error };

  refresh();
  return {
    status: "success",
    message: `${result.assigned.length} assigned · ${result.pending.length} pending · ${result.notOnRoster.length} not in the student list`,
    summary: result,
  };
}
