import Link from "next/link";
import { after } from "next/server";

import {
  CancelTaskButton,
  RunPublisherButton,
} from "@/app/admin/tasks/task-actions";
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
import { formatDateTime } from "@/lib/format";
import { markdownToPlainText } from "@/lib/markdown/discord";
import { requireRole } from "@/lib/rbac";
import { listTasks, publishDueTasks, type TaskState } from "@/server/tasks";

export default async function AdminTasksPage() {
  await requireRole("admin");
  const tasks = await listTasks();

  // Opportunistic catch-up: whoever opens this page nudges the queue along.
  // The real trigger is the cron route; both take the same advisory lock, so
  // running them at the same time is safe.
  after(async () => {
    await publishDueTasks();
  });

  const running = tasks.filter((t) => t.state === "running");
  const upcoming = tasks.filter((t) => t.state === "scheduled");
  const failing = tasks.filter((t) => t.failed > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            A task is written once here and posted into every instructor&apos;s
            #task channel once its start time has passed, pinging that
            instructor&apos;s student role. The publisher runs hourly, so a
            mid-hour start reaches Discord on the next hour — students see it
            on their dashboard straight away either way.
          </p>
        </div>
        <div className="flex gap-2">
          <RunPublisherButton label="Post anything due" />
          <Button
            asChild
            className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
          >
            <Link href="/admin/tasks/new">New task</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="All tasks" value={tasks.length} />
        <StatCard label="Running now" value={running.length} />
        <StatCard label="Scheduled" value={upcoming.length} />
        <StatCard
          label="With failed posts"
          value={failing.length}
          hint={failing.length ? "open one to retry" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All tasks</CardTitle>
          <CardDescription>Newest start date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No tasks yet —{" "}
              <Link href="/admin/tasks/new" className="text-foreground underline">
                write the first one
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="max-w-80">
                        <Link
                          href={`/admin/tasks/${task.id}`}
                          className="block font-medium hover:underline"
                        >
                          {task.title}
                        </Link>
                        <span className="text-muted-foreground line-clamp-1 text-xs">
                          {markdownToPlainText(task.body)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(task.startsAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(task.dueAt)}
                      </TableCell>
                      <TableCell>
                        <StateBadge state={task.state} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {task.delivered}
                        {task.failed > 0 ? (
                          <span className="text-destructive">
                            {" "}
                            · {task.failed} failed
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/tasks/${task.id}`}>Open</Link>
                          </Button>
                          <CancelTaskButton
                            taskId={task.id}
                            cancelled={task.status === "cancelled"}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const STATE_LABEL: Record<TaskState, string> = {
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  running: "Running",
  closed: "Closed",
};

function StateBadge({ state }: { state: TaskState }) {
  return (
    <Badge variant={state === "running" ? "secondary" : "outline"}>
      {STATE_LABEL[state]}
    </Badge>
  );
}
