"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  assignStudentsAction,
  type AssignState,
} from "@/app/admin/instructors/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const initialState: AssignState = { status: "idle" };

export function AssignDialog({
  instructorId,
  instructorName,
}: {
  instructorId: string;
  instructorName: string;
}) {
  const [state, formAction, pending] = useActionState(
    assignStudentsAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const summary = state.summary;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Assign students
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign to {instructorName}</DialogTitle>
          <DialogDescription>
            Paste course emails — separated by newlines, commas or spaces.
            Emails belonging to a verified account are assigned immediately;
            the rest are held and applied the moment that student verifies.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="instructorId" value={instructorId} />
          <Textarea
            name="emails"
            required
            rows={8}
            placeholder={"first@example.com\nsecond@example.com"}
            className="font-mono text-xs"
          />

          {summary ? (
            <div className="grid gap-2 text-xs">
              <SummaryLine label="Assigned" items={summary.assigned} tone="mint" />
              <SummaryLine label="Already assigned" items={summary.alreadyAssigned} />
              <SummaryLine label="Pending verification" items={summary.pending} />
              <SummaryLine
                label="Not in the student list"
                items={summary.notOnRoster}
                tone="destructive"
              />
              <SummaryLine
                label="Discord sync failed"
                items={summary.discordFailures}
                tone="destructive"
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="bg-brand-gradient text-white hover:opacity-90"
            >
              {pending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryLine({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "mint" | "destructive";
}) {
  if (items.length === 0) return null;
  const colour =
    tone === "mint"
      ? "text-mint"
      : tone === "destructive"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="flex gap-3">
      <span className={`${colour} shrink-0 font-medium`}>
        {label} ({items.length})
      </span>
      <span className="text-muted-foreground truncate font-mono">
        {items.join(", ")}
      </span>
    </div>
  );
}
