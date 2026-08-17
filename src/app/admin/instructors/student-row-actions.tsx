"use client";

import { useState } from "react";

import {
  removePendingAction,
  resyncStudentAction,
  transferStudentAction,
  unassignStudentAction,
} from "@/app/admin/instructors/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type InstructorOption = { id: string; displayName: string };

/**
 * Moves one student to another instructor. The same control serves a claimed
 * account and a pending email — the action decides whether there is a Discord
 * side to move, based on which identifier it is handed.
 */
export function TransferButton({
  fromInstructorId,
  instructors,
  label,
  studentUserId,
  courseEmail,
}: {
  fromInstructorId: string;
  instructors: InstructorOption[];
  label: string;
  studentUserId?: string;
  courseEmail?: string;
}) {
  const [formAction, pending] = useToastedAction(transferStudentAction);
  const [target, setTarget] = useState("");

  const options = instructors.filter((i) => i.id !== fromInstructorId);

  // Shown disabled rather than hidden: an action that silently is not there
  // reads as a missing feature, not as "there is nowhere to move them".
  if (options.length === 0) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled
        title="There is no other instructor to move them to yet."
      >
        Transfer
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer {label}</DialogTitle>
          <DialogDescription>
            {studentUserId
              ? "They keep their verification. The old instructor's Discord role comes off and the new one goes on, so their channels change over."
              : "Nobody has verified with this email yet, so this only changes who they will be assigned to once they do."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input
            type="hidden"
            name="fromInstructorId"
            value={fromInstructorId}
          />
          {studentUserId ? (
            <input type="hidden" name="studentUserId" value={studentUserId} />
          ) : null}
          {courseEmail ? (
            <input type="hidden" name="courseEmail" value={courseEmail} />
          ) : null}
          <input type="hidden" name="toInstructorId" value={target} />

          <div className="space-y-2">
            <Label htmlFor="transfer-target">New instructor</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="transfer-target" className="w-full">
                <SelectValue placeholder="Pick an instructor" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !target}>
              {pending ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
