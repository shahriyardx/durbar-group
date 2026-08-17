import Link from "next/link";
import { notFound } from "next/navigation";

import { updateTaskAction } from "@/app/admin/tasks/actions";
import {
  CancelTaskButton,
  DeleteTaskButton,
  PublishNowButton,
  RunPublisherButton,
} from "@/app/admin/tasks/task-actions";
import { TaskForm } from "@/app/admin/tasks/task-form";
import { DiscordMarkdown } from "@/components/discord-markdown";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { getTask, getTaskDeliveries, type TaskState } from "@/server/tasks";

const STATE_LABEL: Record<TaskState, string> = {
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  running: "Running",
  closed: "Closed",
};

export default async function TaskDetailPage({
  params,
}: PageProps<"/admin/tasks/[id]">) {
  await requireRole("admin");
  const { id } = await params;

  const task = await getTask(id);
  if (!task) notFound();

  const deliveries = await getTaskDeliveries(task.id);
  const posted = deliveries.filter((d) => d.postedAt);
  const failed = deliveries.filter((d) => !d.postedAt && d.error);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/tasks"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Tasks
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">{task.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatDateTime(task.startsAt)} → {formatDateTime(task.dueAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {task.state === "scheduled" ? (
              <PublishNowButton taskId={task.id} />
            ) : null}
            {failed.length > 0 ? (
              <RunPublisherButton taskId={task.id} label="Retry failed" />
            ) : null}
            <CancelTaskButton
              taskId={task.id}
              cancelled={task.status === "cancelled"}
            />
            <DeleteTaskButton taskId={task.id} title={task.title} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="State" value={STATE_LABEL[task.state]} />
        <StatCard label="Delivered" value={posted.length} />
        <StatCard label="Failed" value={failed.length} />
        <StatCard
          label="Published"
          value={task.publishedAt ? "Yes" : "No"}
          hint={
            task.publishedAt
              ? formatDateTime(task.publishedAt)
              : "waiting for every instructor"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What Discord shows</CardTitle>
          <CardDescription>
            The student role of each instructor is mentioned above this, and
            the start and deadline are appended as Discord timestamps so every
            student sees them in their own timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscordMarkdown
            markdown={task.body}
            className="border-border/60 bg-card/40 rounded-xl border p-5"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>
            One row per instructor. A failed row is retried on every publish
            run, and a successful one is never posted twice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Not posted anywhere yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((row) => (
                    <TableRow key={row.instructorId}>
                      <TableCell className="font-medium">
                        {row.instructorName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(row.postedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.attempts}
                      </TableCell>
                      <TableCell>
                        {row.postedAt ? (
                          <Badge variant="secondary">Delivered</Badge>
                        ) : (
                          <span className="text-destructive text-xs">
                            {row.error ?? "Pending"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.postedAt && row.channelId && row.messageId ? (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${row.channelId}/${row.messageId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open ↗
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit</CardTitle>
          <CardDescription>
            Saving rewrites the messages Discord already has, so the two never
            disagree. Discord does not re-notify on an edit, so nobody is
            pinged a second time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm
            action={updateTaskAction}
            submitLabel="Save changes"
            task={{
              id: task.id,
              title: task.title,
              body: task.body,
              startsAt: task.startsAt,
              dueAt: task.dueAt,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
