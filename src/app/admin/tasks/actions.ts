"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseLocalInputValue } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import {
  createTask,
  deleteTask,
  publishDueTasks,
  setTaskStatus,
  startTaskNow,
  taskInputSchema,
  updateTask,
  type TaskInput,
} from "@/server/tasks";

function refresh(taskId?: string) {
  revalidatePath("/admin/tasks", "layout");
  revalidatePath("/admin");
  revalidatePath("/student");
  if (taskId) revalidatePath(`/admin/tasks/${taskId}`);
}

export type TaskFormState = {
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
): { ok: true; value: TaskInput } | { ok: false; state: TaskFormState } {
  const startsRaw = String(formData.get("startsAt") ?? "").trim();
  const dueRaw = String(formData.get("dueAt") ?? "").trim();

  const startsAt = startsRaw ? parseLocalInputValue(startsRaw) : null;
  const dueAt = dueRaw ? parseLocalInputValue(dueRaw) : null;

  if (startsRaw && !startsAt) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "That start date could not be read.",
        fieldErrors: { startsAt: "Not a valid date and time." },
      },
    };
  }
  if (!dueAt) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "A deadline is required.",
        fieldErrors: { dueAt: "Pick a deadline." },
      },
    };
  }

  const parsed = taskInputSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    startsAt,
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
      state: {
        status: "error",
        message: "Fix the highlighted fields.",
        fieldErrors,
      },
    };
  }

  return { ok: true, value: parsed.data };
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const admin = await requireRole("admin");
  const parsed = readForm(formData);
  if (!parsed.ok) return parsed.state;

  const task = await createTask(parsed.value, admin.id);
  // A task that starts now should reach Discord now, not on the next tick.
  if (task.startsAt <= new Date()) await publishDueTasks(task.id);

  refresh(task.id);
  redirect(`/admin/tasks/${task.id}`);
}

export async function updateTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return { status: "error", message: "Missing task." };

  const parsed = readForm(formData);
  if (!parsed.ok) return parsed.state;

  const updated = await updateTask(taskId, parsed.value);
  if (!updated) return { status: "error", message: "That task is gone." };

  refresh(taskId);
  return {
    status: "success",
    // Editing does not rewrite messages Discord already has.
    message: "Task updated. Messages already posted to Discord are unchanged.",
  };
}

export async function publishTaskNowAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return { status: "error", message: "Missing task." };

  await startTaskNow(taskId);
  const result = await publishDueTasks(taskId);
  refresh(taskId);

  if (!result.ran) {
    return {
      status: "error",
      message: "Another publish run is in progress — try again in a moment.",
    };
  }
  return result.failed > 0
    ? {
        status: "error",
        message: `${result.posted} posted, ${result.failed} failed. See the delivery list.`,
      }
    : { status: "success", message: `Posted to ${result.posted} channels.` };
}

export async function retryTaskAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  const result = await publishDueTasks(taskId || undefined);
  refresh(taskId || undefined);

  if (!result.ran) {
    return {
      status: "error",
      message: "Another publish run is in progress — try again in a moment.",
    };
  }
  if (result.posted === 0 && result.failed === 0) {
    return { status: "success", message: "Nothing was waiting to be posted." };
  }
  return result.failed > 0
    ? {
        status: "error",
        message: `${result.posted} posted, ${result.failed} still failing.`,
      }
    : { status: "success", message: `Posted to ${result.posted} channels.` };
}

export async function setTaskStatusAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!taskId || (next !== "cancelled" && next !== "scheduled")) {
    return { status: "error", message: "Missing task." };
  }

  await setTaskStatus(taskId, next);
  refresh(taskId);
  return {
    status: "success",
    message:
      next === "cancelled"
        ? "Cancelled. It will not be posted, and students stop seeing it."
        : "Restored. It will be posted on the next run.",
  };
}

export async function deleteTaskAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return { status: "error", message: "Missing task." };

  await deleteTask(taskId);
  refresh();
  redirect("/admin/tasks");
}
