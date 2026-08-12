"use client";

import {
  removePendingAction,
  resyncStudentAction,
  unassignStudentAction,
} from "@/app/admin/instructors/actions";
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

export function ResyncButton({ studentUserId }: { studentUserId: string }) {
  const [formAction, pending] = useToastedAction(resyncStudentAction);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="studentUserId" value={studentUserId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Syncing…" : "Re-sync"}
      </Button>
    </form>
  );
}

export function UnassignButton({
  studentUserId,
  instructorId,
  studentName,
  instructorName,
}: {
  studentUserId: string;
  instructorId: string;
  studentName: string;
  instructorName: string;
}) {
  const [formAction, pending] = useToastedAction(unassignStudentAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          Unassign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unassign {studentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose the student role for {instructorName}, so the category
            and all six channels disappear for them. Their account and
            verification stay intact, and they can be assigned again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="studentUserId" value={studentUserId} />
            <input type="hidden" name="instructorId" value={instructorId} />
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              Unassign
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WithdrawPendingButton({
  courseEmail,
  instructorId,
}: {
  courseEmail: string;
  instructorId: string;
}) {
  const [formAction, pending] = useToastedAction(removePendingAction);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="courseEmail" value={courseEmail} />
      <input type="hidden" name="instructorId" value={instructorId} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
      >
        Withdraw
      </Button>
    </form>
  );
}
