"use client";

import {
  retryProvisionAction,
  revokeInstructorAction,
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

export function RetryProvisionButton({
  instructorId,
}: {
  instructorId: string;
}) {
  const [formAction, pending] = useToastedAction(retryProvisionAction);

  return (
    <form action={formAction}>
      <input type="hidden" name="instructorId" value={instructorId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Provisioning…" : "Retry Discord setup"}
      </Button>
    </form>
  );
}

export function RevokeInstructorButton({
  instructorId,
  instructorName,
}: {
  instructorId: string;
  instructorName: string;
}) {
  const [formAction, pending] = useToastedAction(revokeInstructorAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {instructorName}&apos;s teaching space?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This deletes their Discord category, all six channels and both
            roles, and drops every student assignment. Channel history is not
            recoverable. A plain instructor goes back to being a student; an
            admin keeps their admin rights.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="instructorId" value={instructorId} />
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              {pending ? "Removing…" : "Remove teaching space"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
