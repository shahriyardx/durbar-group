import Link from "next/link";

import { createTaskAction } from "@/app/admin/tasks/actions";
import { TaskForm } from "@/app/admin/tasks/task-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/rbac";

export default async function NewTaskPage() {
  await requireRole("admin");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/tasks"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Tasks
        </Link>
        <h1 className="font-heading mt-2 text-2xl font-bold">New task</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          What you write is posted verbatim to Discord, so the preview beside
          the editor is exactly what students will read.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Write the task</CardTitle>
          <CardDescription>
            It goes out to every instructor&apos;s #task channel at the start
            time, with their student role mentioned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm action={createTaskAction} submitLabel="Create task" />
        </CardContent>
      </Card>
    </div>
  );
}
