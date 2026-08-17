"use client";

import { revokeVerificationAction } from "@/app/admin/students/actions";
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
