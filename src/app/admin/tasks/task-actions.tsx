"use client";

import {
  deleteTaskAction,
  publishTaskNowAction,
  retryTaskAction,
  setTaskStatusAction,
} from "@/app/admin/tasks/actions";
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

export function PublishNowButton({ taskId }: { taskId: string }) {
  const [formAction, pending] = useToastedAction(publishTaskNowAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Publish now
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Post this task right now?</AlertDialogTitle>
          <AlertDialogDescription>
            The start time moves to now and the task is posted into every
            instructor&apos;s #task channel, pinging their student role. Discord
            messages cannot be un-sent from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <AlertDialogAction type="submit" disabled={pending}>
              Publish
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Retries one task's failed deliveries, or the whole queue with no id. */
export function RunPublisherButton({
  taskId,
  label = "Run publisher",
  className,
  size = "sm",
}: {
  taskId?: string;
  label?: string;
  /** Set when it sits beside a primary button and has to match its shape. */
  className?: string;
  size?: "sm" | "default";
}) {
  const [formAction, pending] = useToastedAction(retryTaskAction);

  return (
    <form action={formAction} className="inline">
      {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
      <Button
        type="submit"
        size={size}
        variant="outline"
        disabled={pending}
        className={className}
      >
        {pending ? "Posting…" : label}
      </Button>
    </form>
  );
}

export function CancelTaskButton({
  taskId,
  cancelled,
}: {
  taskId: string;
  cancelled: boolean;
}) {
  const [formAction, pending] = useToastedAction(setTaskStatusAction);

  if (cancelled) {
    return (
      <form action={formAction} className="inline">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="status" value="scheduled" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Restore
        </Button>
      </form>
    );
  }

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value="cancelled" />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
      >
        Cancel
      </Button>
    </form>
  );
}

export function DeleteTaskButton({
  taskId,
  title,
}: {
  taskId: string;
  title: string;
}) {
  const [formAction, pending] = useToastedAction(deleteTaskAction);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Every message already posted is deleted from Discord, then the task
            and its delivery record go too, and students stop seeing it. If a
            message cannot be deleted the task is kept so you can retry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="taskId" value={taskId} />
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
