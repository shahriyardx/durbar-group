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
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Assign to {instructorName}</DialogTitle>
          <DialogDescription>
            Paste course emails — separated by newlines, commas or spaces.
            Emails belonging to a verified account are assigned immediately;
            the rest are held and applied the moment that student verifies.
          </DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <input type="hidden" name="instructorId" value={instructorId} />
          {/* A pasted list of a few hundred emails must not push the Assign
              button off screen, so the box keeps its height and scrolls.
              `field-sizing-fixed` undoes the Textarea default of growing to
              fit its content. */}
          <Textarea
            name="emails"
            required
            placeholder={"first@example.com\nsecond@example.com"}
            className="field-sizing-fixed h-48 min-h-24 resize-none overflow-y-auto font-mono text-xs"
          />

          {summary ? (
            <div className="grid shrink-0 gap-2 text-xs">
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

          <DialogFooter className="shrink-0">
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

  // Counts only. Spelling out dozens of addresses here told the admin nothing
  // they could act on and forced the dialog to scroll sideways.
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`${colour} font-medium`}>{label}</span>
      <span className="text-muted-foreground font-mono tabular-nums">
        {items.length}
      </span>
    </div>
  );
}
