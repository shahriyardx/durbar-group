"use client";

import {
  deleteStudentAction,
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
import { useToastedAction } from "@/hooks/use-toasted-action";

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
        <Button size="sm" variant="ghost" className="text-destructive">
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
        variant="ghost"
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
        <Button size="sm" variant="ghost" className="text-destructive">
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
