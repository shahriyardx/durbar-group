"use server";

import { revalidatePath } from "next/cache";

import { parseLocalDateValue, parseLocalInputValue } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import {
  createOutlineItem,
  deleteOutlineItem,
  outlineInputSchema,
  updateOutlineItem,
  type OutlineInput,
} from "@/server/outline";

function refresh() {
  revalidatePath("/admin/outline");
  revalidatePath("/admin");
  revalidatePath("/student");
}

export type OutlineFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type SimpleState = {
  status: "idle" | "error" | "success";
  message?: string;
};

function readForm(
  formData: FormData,
): { ok: true; value: OutlineInput } | { ok: false; state: OutlineFormState } {
  const releasedRaw = String(formData.get("releasedAt") ?? "").trim();
  const dueRaw = String(formData.get("dueAt") ?? "").trim();

  const releasedAt = releasedRaw ? parseLocalDateValue(releasedRaw) : null;
  // Empty stays null; a value that will not parse is an error, not a null.
  const dueAt = dueRaw ? parseLocalInputValue(dueRaw) : null;

  if (!releasedAt) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "A release date is required.",
        fieldErrors: { releasedAt: "Pick the day this opens." },
      },
    };
  }
  if (dueRaw && !dueAt) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "That deadline could not be read.",
        fieldErrors: { dueAt: "Not a valid date and time." },
      },
    };
  }

  const parsed = outlineInputSchema.safeParse({
    title: formData.get("title"),
    releasedAt,
    dueAt,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      state: { status: "error", message: "Fix the highlighted fields.", fieldErrors },
    };
  }

  return { ok: true, value: parsed.data };
}

export async function createOutlineAction(
  _prev: OutlineFormState,
  formData: FormData,
): Promise<OutlineFormState> {
  const admin = await requireRole("admin");
  const parsed = readForm(formData);
  if (!parsed.ok) return parsed.state;

  const row = await createOutlineItem(parsed.value, admin.id);
  refresh();
  return { status: "success", message: `“${row.title}” added to the outline.` };
}

export async function updateOutlineAction(
  _prev: OutlineFormState,
  formData: FormData,
): Promise<OutlineFormState> {
  await requireRole("admin");
  const id = String(formData.get("itemId") ?? "");
  if (!id) return { status: "error", message: "Missing outline entry." };

  const parsed = readForm(formData);
  if (!parsed.ok) return parsed.state;

  const row = await updateOutlineItem(id, parsed.value);
  if (!row) return { status: "error", message: "That outline entry is gone." };

  refresh();
  return { status: "success", message: "Outline entry updated." };
}

export async function deleteOutlineAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const id = String(formData.get("itemId") ?? "");
  if (!id) return { status: "error", message: "Missing outline entry." };

  await deleteOutlineItem(id);
  refresh();
  return { status: "success", message: "Removed from the outline." };
}
