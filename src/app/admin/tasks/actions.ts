"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseLocalInputValue } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import {
  createTask,
  deleteTask,
  deleteTaskMessages,
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

  const { changed, failed } = updated.discord;
  if (failed > 0) {
    return {
      status: "error",
      message: `Task saved, but ${failed} Discord ${
        failed === 1 ? "message" : "messages"
      } could not be rewritten. See the delivery list.`,
    };
  }
  return {
    status: "success",
    message: changed
      ? `Task updated, and ${changed} Discord ${
          changed === 1 ? "message" : "messages"
        } rewritten.`
      : "Task updated.",
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

  const removed = await setTaskStatus(taskId, next);
  refresh(taskId);

  if (next === "scheduled") {
    return {
      status: "success",
      message: "Restored. It will be posted again on the next run.",
    };
  }
  if (removed && removed.failed > 0) {
    return {
      status: "error",
      message: `Cancelled, but ${removed.failed} Discord ${
        removed.failed === 1 ? "message" : "messages"
      } could not be deleted — remove ${
        removed.failed === 1 ? "it" : "them"
      } by hand.`,
    };
  }
  return {
    status: "success",
    message: removed?.changed
      ? `Cancelled. ${removed.changed} Discord ${
          removed.changed === 1 ? "message" : "messages"
        } deleted, and students stop seeing it.`
      : "Cancelled. It will not be posted, and students stop seeing it.",
  };
}

export async function deleteTaskAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireRole("admin");
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return { status: "error", message: "Missing task." };

  // Take the messages down first. If any survive, keep the task so the admin
  // can retry — deleting the row would lose track of where they are.
  const removed = await deleteTaskMessages(taskId);
  if (removed.failed > 0) {
    refresh(taskId);
    return {
      status: "error",
      message: `Kept the task: ${removed.failed} Discord ${
        removed.failed === 1 ? "message" : "messages"
      } could not be deleted. Fix that and try again.`,
    };
  }

  await deleteTask(taskId);
  refresh();
  redirect("/admin/tasks");
}
