"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@/db";
import { hasRole, requireRole } from "@/lib/rbac";
import { importRoster, parseRosterFile } from "@/server/roster";
import { revokeVerification } from "@/server/verification";

export type ImportState = {
  status: "idle" | "error" | "success";
  message?: string;
  created?: number;
  updated?: number;
  skipped?: { row: number; reason: string; value: string }[];
};

export async function importRosterAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const admin = await requireRole("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a spreadsheet to upload." };
  }

  const parsed = await parseRosterFile(file);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  if (parsed.rows.length === 0) {
    return {
      status: "error",
      message: "No usable rows found in that file.",
      skipped: parsed.skipped,
    };
  }

  const summary = await importRoster(parsed.rows, admin.id, file.name);
  revalidatePath("/admin/students");
  revalidatePath("/admin");

  return {
    status: "success",
    message: `Imported ${summary.total} rows from ${file.name}.`,
    created: summary.created,
    updated: summary.updated,
    skipped: parsed.skipped,
  };
}

export type PreviewState = {
  status: "idle" | "reading" | "error" | "ready";
  message?: string;
  fileName?: string;
  students?: number;
  columns?: string[];
  skipped?: { row: number; reason: string; value: string }[];
};

/**
 * Counts what a file would import, without writing anything. It runs the very
 * same parser the import uses, so the number an admin sees before pressing the
 * button is the number they will get.
 */
export async function previewRosterAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  await requireRole("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "idle" };

  const parsed = await parseRosterFile(file);
  if ("error" in parsed) {
    return { status: "error", message: parsed.error, fileName: file.name };
  }

  return {
    status: "ready",
    fileName: file.name,
    students: parsed.rows.length,
    columns: parsed.columns,
    skipped: parsed.skipped,
  };
}

export type SimpleState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/** Whether this account is a plain student, and so safe to un-verify. */
async function getUserForRevoke(userId: string) {
  const [row] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!row) return null;

  const [teaching] = await db
    .select({ id: schema.instructor.id })
    .from(schema.instructor)
    .where(eq(schema.instructor.userId, userId))
    .limit(1);

  return { blocked: hasRole(row.role, "instructor") || Boolean(teaching) };
}

export async function revokeVerificationAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  if (!studentUserId) return { status: "error", message: "Missing student." };

  const target = await getUserForRevoke(studentUserId);
  if (!target) return { status: "error", message: "That account is gone." };
  // Kicking somebody who teaches or administers would be a much bigger act
  // than "make this student verify again", so it is refused outright.
  if (target.blocked) {
    return {
      status: "error",
      message:
        "That account is an instructor or admin — remove their teaching space or demote them first.",
    };
  }

  const result = await revokeVerification(studentUserId);
  revalidatePath("/admin", "layout");
  revalidatePath("/student");

  if (result.discordError) {
    return {
      status: "error",
      message: `Verification removed, but Discord cleanup failed: ${result.discordError}`,
    };
  }
  return {
    status: "success",
    message: `Verification removed${
      result.courseEmail ? ` for ${result.courseEmail}` : ""
    }. ${result.assignmentsRemoved} assignment${
      result.assignmentsRemoved === 1 ? "" : "s"
    } dropped${result.removedFromGuild ? ", and they were removed from the Discord server" : ""}.`,
  };
}
