"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { OutlineFormState } from "@/app/admin/outline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLocalDateInputValue, toLocalInputValue } from "@/lib/format";

const initialState: OutlineFormState = { status: "idle" };

export function OutlineForm({
  action,
  submitLabel,
  item,
  /** Create keeps the form on screen, so it clears itself for the next entry. */
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (
    prev: OutlineFormState,
    formData: FormData,
  ) => Promise<OutlineFormState>;
  submitLabel: string;
  item?: { id: string; title: string; releasedAt: Date; dueAt: Date | null };
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
    }
    // Field errors render inline; anything else is worth a toast.
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state, resetOnSuccess, onSuccess]);

  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor={`title-${item?.id ?? "new"}`}>Title</Label>
        <Input
          id={`title-${item?.id ?? "new"}`}
          name="title"
          defaultValue={item?.title}
          placeholder="Module 4 — Databases"
          maxLength={180}
          required
        />
        <FieldError message={error("title")} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`releasedAt-${item?.id ?? "new"}`}>Release date</Label>
          <Input
            id={`releasedAt-${item?.id ?? "new"}`}
            name="releasedAt"
            type="date"
            defaultValue={item ? toLocalDateInputValue(item.releasedAt) : ""}
            required
          />
          <p className="text-muted-foreground text-xs">
            The day this opens. Students see the whole outline either way; this
            is what orders it and marks an entry as upcoming.
          </p>
          <FieldError message={error("releasedAt")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`dueAt-${item?.id ?? "new"}`}>Deadline</Label>
          <Input
            id={`dueAt-${item?.id ?? "new"}`}
            name="dueAt"
            type="datetime-local"
            defaultValue={item ? toLocalInputValue(item.dueAt) : ""}
          />
          <p className="text-muted-foreground text-xs">
            Optional, Bangladesh time. Leave it empty for anything with no
            hand-in — a session, a module opening.
          </p>
          <FieldError message={error("dueAt")} />
        </div>
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
