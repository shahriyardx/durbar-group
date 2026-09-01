"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteStudentAction,
  eliminateStudentAction,
  restoreStudentAction,
  revokeVerificationAction,
} from "@/app/admin/students/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToastedAction } from "@/hooks/use-toasted-action";
import { CRITERIA_SHORT } from "@/lib/criteria";

/**
 * Destructive row actions read as buttons rather than as red text: they sit
 * three-across in a table cell, and a bare label there looks like a link.
 */
const DESTRUCTIVE_OUTLINE =
  "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive";

/**
 * Sends a student back to the verification form. Everything that depended on
 * the verification — assignments, Discord membership — goes with it.
 */
export function RevokeVerificationButton({
  studentUserId,
  studentName,
  courseEmail,
}: {
  studentUserId: string;
  studentName: string;
  courseEmail: string | null;
}) {
  const [formAction, pending] = useToastedAction(revokeVerificationAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className={DESTRUCTIVE_OUTLINE}>
          Un-verify
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Un-verify {studentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {courseEmail ? <strong>{courseEmail}</strong> : "Their course email"}{" "}
            is released so it can be claimed again, every assignment is dropped,
            and they are removed from the Discord server. Their account stays,
            and they land back on the verification form the next time they open
            the site.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="studentUserId" value={studentUserId} />
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              Un-verify
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Removes the imported row. Disabled while somebody holds it, because the
 * action refuses that case anyway — showing why up front beats a red toast
 * after the click.
 */
export function DeleteStudentButton({
  id,
  email,
  claimed,
}: {
  id: string;
  email: string;
  claimed: boolean;
}) {
  const [formAction, pending] = useToastedAction(deleteStudentAction);

  if (claimed) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Somebody has verified with this email. Un-verify them first."
      >
        Delete
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className={DESTRUCTIVE_OUTLINE}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {email}?</AlertDialogTitle>
          <AlertDialogDescription>
            They leave the student list, so this email can no longer be
            verified with — anyone trying is told they are not enrolled. Any
            assignment parked against it goes too. Importing a sheet that still
            contains this email brings it straight back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              Delete
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Eliminate a student from the Durbar Group.
 *
 * The reason is required and is not an internal note: it is shown to the
 * student verbatim, on the page they land on the next time they sign in. The
 * criteria are listed beside the box so the reason can quote the one that was
 * missed rather than being written from memory.
 */
export function EliminateStudentButton({
  studentUserId,
  studentName,
}: {
  studentUserId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // The result is handled here rather than in an effect: closing the dialog
  // is a reaction to the submit, not to a render, and React's compiler flags
  // setState inside an effect body.
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await eliminateStudentAction({ status: "idle" }, formData);
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={DESTRUCTIVE_OUTLINE}>
          Eliminate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Eliminate {studentName}?</DialogTitle>
          <DialogDescription>
            They are sent this reason as a Discord DM, then removed from the
            server. Every session they hold is ended, and they cannot sign
            back in — the next attempt shows them this reason instead of a
            dashboard. Nothing is deleted: their record stays on this page,
            and you can undo it.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-4">
          <input type="hidden" name="studentUserId" value={studentUserId} />

          <div className="space-y-2">
            <Label htmlFor="reason">Reason, in the student&apos;s words</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="যেমন: ২ নম্বর ক্রাইটেরিয়া — অ্যাসাইনমেন্টে ন্যূনতম ৯০% নম্বর পাওনি।"
              className="font-bangla max-h-40 resize-none"
            />
            <p className="text-muted-foreground text-xs">
              Shown to them exactly as written. The criteria are:{" "}
              <span className="font-bangla">{CRITERIA_SHORT.join(" · ")}</span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              {pending ? "Eliminating…" : "Eliminate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Undo an elimination. Discord access comes back via their rejoin button. */
export function RestoreStudentButton({
  studentUserId,
  studentName,
}: {
  studentUserId: string;
  studentName: string;
}) {
  const [formAction, pending] = useToastedAction(restoreStudentAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Restore
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Put {studentName} back in the group?</AlertDialogTitle>
          <AlertDialogDescription>
            They can sign in again and their dashboard comes back, with the
            verification and assignments they already had. Discord is not
            rejoined automatically — the rejoin button on their own dashboard
            does that, because it needs their Discord login, not ours.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="studentUserId" value={studentUserId} />
            <AlertDialogAction type="submit" disabled={pending}>
              Restore
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
