"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import type { TaskFormState } from "@/app/admin/tasks/actions";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLocalInputValue } from "@/lib/format";

const initialState: TaskFormState = { status: "idle" };

export function TaskForm({
  action,
  submitLabel,
  task,
}: {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  submitLabel: string;
  task?: {
    id: string;
    title: string;
    body: string;
    startsAt: Date;
    dueAt: Date;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    // Field errors render inline; anything else is worth a toast.
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-8">
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={task?.title}
          placeholder="Week 3 — build a REST API"
          maxLength={180}
          required
        />
        <FieldError message={error("title")} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={task ? toLocalInputValue(task.startsAt) : ""}
          />
          <p className="text-muted-foreground text-xs">
            Optional — empty means now, and a task that starts now is posted
            immediately. Otherwise the publisher runs hourly, so a start time
            mid-hour reaches Discord on the next hour. &ldquo;Publish now&rdquo;
            skips the wait.
          </p>
          <FieldError message={error("startsAt")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueAt">Deadline</Label>
          <Input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={task ? toLocalInputValue(task.dueAt) : ""}
            required
          />
          <p className="text-muted-foreground text-xs">
            Bangladesh time. Students see it counted down on their dashboard.
          </p>
          <FieldError message={error("dueAt")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <MarkdownEditor name="body" defaultValue={task?.body ?? ""} />
        <FieldError message={error("body")} />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
      >
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}
