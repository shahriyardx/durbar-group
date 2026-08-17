"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  addStudentAction,
  type AddStudentState,
} from "@/app/admin/students/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AddStudentState = { status: "idle" };

export function AddStudentForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    addStudentAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
    // Field problems are shown against the field; anything else is a toast.
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="add-email">Course email</Label>
        <Input
          id="add-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="student@gmail.com"
          required
        />
        <FieldError message={error("email")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="add-name">
            Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="add-name" name="name" autoComplete="off" />
          <FieldError message={error("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-phone">
            Phone <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="add-phone" name="phone" autoComplete="off" />
          <FieldError message={error("phone")} />
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        The email is what a student verifies with, so it has to match the one
        they enrolled with. Adding an email that is already in the list updates
        that entry instead of duplicating it.
      </p>

      <Button
        type="submit"
        disabled={pending}
        className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
      >
        {pending ? "Adding…" : "Add student"}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}
