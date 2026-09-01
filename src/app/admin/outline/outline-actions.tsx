"use client";

import { useCallback, useState } from "react";

import {
  deleteOutlineAction,
  updateOutlineAction,
} from "@/app/admin/outline/actions";
import { OutlineForm } from "@/app/admin/outline/outline-form";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToastedAction } from "@/hooks/use-toasted-action";

export type OutlineItemProps = {
  id: string;
  title: string;
  releasedAt: Date;
  dueAt: Date | null;
};

export function EditOutlineButton({ item }: { item: OutlineItemProps }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit outline entry</DialogTitle>
          <DialogDescription>
            Students see the change on their dashboard straight away.
          </DialogDescription>
        </DialogHeader>
        <OutlineForm
          action={updateOutlineAction}
          submitLabel="Save changes"
          item={item}
          onSuccess={close}
        />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteOutlineButton({
  itemId,
  title,
}: {
  itemId: string;
  title: string;
}) {
  const [formAction, pending] = useToastedAction(deleteOutlineAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove “{title}” from the outline?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from every student&apos;s dashboard. Nothing on
            Discord is touched — the outline never posts there.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="itemId" value={itemId} />
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
