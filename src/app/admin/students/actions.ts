"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db, schema } from "@/db";
import { hasRole, requireRole } from "@/lib/rbac";
import { eliminateStudent, restoreStudent } from "@/server/elimination";
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

export type AddStudentState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const addStudentSchema = z.object({
  email: z.email("That is not a valid email address."),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
});

/**
 * Add one student without a spreadsheet. It goes through `importRoster` rather
 * than its own insert, so a hand-typed row gets exactly the same treatment as
 * an imported one: lowercased email, upsert on conflict, and a blank field
 * that never wipes what is already stored.
 */
export async function addStudentAction(
  _prev: AddStudentState,
  formData: FormData,
): Promise<AddStudentState> {
  const admin = await requireRole("admin");

  const parsed = addStudentSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      status: "error",
      message: "Fix the highlighted fields.",
      fieldErrors,
    };
  }

  const summary = await importRoster(
    [parsed.data],
    admin.id,
    "Added by hand",
  );
  revalidatePath("/admin/students");
  revalidatePath("/admin");

  return {
    status: "success",
    message: summary.updated
      ? `${parsed.data.email} was already in the list — updated it.`
      : `${parsed.data.email} added.`,
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

/**
 * Remove an imported student. Refused while the row is claimed: deleting it
 * would leave a verified account whose proof of enrolment no longer exists,
 * and re-importing that email later would hand it to whoever claims it first
 * while the original account still holds it as its course email. Un-verify
 * releases the row, and then it can go.
 */
export async function deleteStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Missing student." };

  const [row] = await db
    .select({
      email: schema.importedStudent.email,
      claimedByUserId: schema.importedStudent.claimedByUserId,
    })
    .from(schema.importedStudent)
    .where(eq(schema.importedStudent.id, id))
    .limit(1);

  if (!row) return { status: "error", message: "That student is already gone." };
  if (row.claimedByUserId) {
    return {
      status: "error",
      message:
        "Somebody has verified with this email. Un-verify them first, then delete.",
    };
  }

  // Assignments parked against the email have nothing left to attach to.
  const pending = await db
    .delete(schema.pendingAssignment)
    .where(eq(schema.pendingAssignment.courseEmail, row.email))
    .returning({ id: schema.pendingAssignment.id });

  await db
    .delete(schema.importedStudent)
    .where(eq(schema.importedStudent.id, id));

  revalidatePath("/admin/students");
  revalidatePath("/admin");
  revalidatePath("/admin/instructors", "layout");

  return {
    status: "success",
    message: pending.length
      ? `${row.email} deleted, along with ${pending.length} pending assignment${
          pending.length === 1 ? "" : "s"
        }.`
      : `${row.email} deleted.`,
  };
}

const eliminationReasonSchema = z
  .string()
  .trim()
  .min(10, "Write a reason the student can actually read.")
  .max(1000, "Keep the reason under 1000 characters.");

/**
 * Eliminate a student from the Durbar Group.
 *
 * Guarded the same way un-verify is: an instructor or admin account is not a
 * student, and eliminating one would lock somebody out of their own teaching
 * space. Demote them first if that is really the intent.
 */
export async function eliminateStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const admin = await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  if (!studentUserId) return { status: "error", message: "Missing student." };

  const reason = eliminationReasonSchema.safeParse(formData.get("reason") ?? "");
  if (!reason.success) {
    return { status: "error", message: reason.error.issues[0].message };
  }

  const target = await getUserForRevoke(studentUserId);
  if (!target) return { status: "error", message: "That account is gone." };
  if (target.blocked) {
    return {
      status: "error",
      message:
        "That account is an instructor or admin — demote them or remove their teaching space first.",
    };
  }

  const result = await eliminateStudent(studentUserId, reason.data, admin.id);
  if (!result) return { status: "error", message: "That account is gone." };

  revalidatePath("/admin", "layout");
  revalidatePath("/student");

  if (result.discordError) {
    return {
      status: "error",
      message: `${result.name} eliminated and signed out, but the Discord removal failed: ${result.discordError}`,
    };
  }
  return {
    status: "success",
    message: `${result.name} eliminated${
      result.notified ? ", told why by DM" : ""
    }${result.removedFromGuild ? ", removed from Discord" : ""}, and ${
      result.sessionsKilled
    } session${result.sessionsKilled === 1 ? "" : "s"} ended.${
      result.notified
        ? ""
        : " The DM did not go through — they have DMs from server members turned off, so the reason is only on their sign-in screen."
    }`,
  };
}

/**
 * Put an elimination back. Discord access is not restored here — the rejoin
 * button on their own dashboard does that with their own OAuth token.
 */
export async function restoreStudentAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const studentUserId = String(formData.get("studentUserId") ?? "");
  if (!studentUserId) return { status: "error", message: "Missing student." };

  const row = await restoreStudent(studentUserId);
  if (!row) return { status: "error", message: "That account is gone." };

  revalidatePath("/admin", "layout");
  revalidatePath("/student");

  return {
    status: "success",
    message: `${row.name} is back in the group. They can sign in again, and the rejoin button on their dashboard puts them back into Discord.`,
  };
}
