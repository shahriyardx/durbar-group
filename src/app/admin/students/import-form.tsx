"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  importRosterAction,
  type ImportState,
} from "@/app/admin/students/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ImportState = { status: "idle" };

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    importRosterAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">Student list file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,.xlsm,.csv"
          required
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          .xlsx or .csv with a header row. An <strong>Email</strong> column is
          required; Name, Student ID, Batch and Phone are picked up when
          present, and any other column is kept as extra data.
        </p>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
      >
        {pending ? "Importing…" : "Import students"}
      </Button>

      {state.status === "success" ? (
        <div className="border-mint/40 bg-mint/5 rounded-xl border p-4 text-sm">
          <p className="font-medium">
            {state.created} added · {state.updated} updated
          </p>
        </div>
      ) : null}

      {state.skipped && state.skipped.length > 0 ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
          <p className="text-destructive text-sm font-medium">
            {state.skipped.length} rows skipped
          </p>
          <ul className="text-muted-foreground mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-xs">
            {state.skipped.map((row) => (
              <li key={`${row.row}-${row.value}`}>
                row {row.row}: {row.reason}
                {row.value ? ` (${row.value})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
