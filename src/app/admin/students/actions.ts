"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/rbac";
import { importRoster, parseRosterFile } from "@/server/roster";

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
