import { and, count, eq, gt, gte, isNotNull, lte, ne } from "drizzle-orm";
import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/rbac";

const SHORTCUTS = [
  {
    href: "/admin/students",
    title: "Import students",
    body: "Upload an Excel or CSV export. Rows match on email, so re-uploading is safe.",
  },
  {
    href: "/admin/instructors",
    title: "Add an instructor",
    body: "Creates their Discord category, six channels and both access roles. Admins can teach too.",
  },
  {
    href: "/admin/instructors",
    title: "Assign students",
    body: "Paste course emails against an instructor. Unverified emails wait until they verify.",
  },
  {
    href: "/admin/tasks",
    title: "Set a task",
    body: "Write it once in markdown; it posts to every instructor's #task channel at its start time.",
  },
  {
    href: "/admin/users",
    title: "Manage accounts",
    body: "Change roles or ban an account. Admin-level changes need a super admin.",
  },
];

async function counts() {
  const now = new Date();
  const [
    [users],
    [roster],
    [claimed],
    [instructors],
    [assignments],
    [pending],
    [runningTasks],
    [scheduledTasks],
  ] = await Promise.all([
    db.select({ n: count() }).from(schema.user),
    db.select({ n: count() }).from(schema.importedStudent),
    db
      .select({ n: count() })
      .from(schema.importedStudent)
      .where(isNotNull(schema.importedStudent.claimedByUserId)),
    db.select({ n: count() }).from(schema.instructor),
    db.select({ n: count() }).from(schema.studentAssignment),
    db.select({ n: count() }).from(schema.pendingAssignment),
    db
      .select({ n: count() })
      .from(schema.task)
      .where(
        and(
          ne(schema.task.status, "cancelled"),
          lte(schema.task.startsAt, now),
          gte(schema.task.dueAt, now),
        ),
      ),
    db
      .select({ n: count() })
      .from(schema.task)
      .where(and(eq(schema.task.status, "scheduled"), gt(schema.task.startsAt, now))),
  ]);

  return {
    users: users.n,
    roster: roster.n,
    claimed: claimed.n,
    instructors: instructors.n,
    assignments: assignments.n,
    pending: pending.n,
    runningTasks: runningTasks.n,
    scheduledTasks: scheduledTasks.n,
  };
}

export default async function AdminPage() {
  const user = await requireRole("admin");
  const stats = await counts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {user.name} ·{" "}
          {user.role === "super_admin" ? "super admin" : "admin"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Accounts" value={stats.users} />
        <StatCard
          label="Imported students"
          value={stats.roster}
          hint={`${stats.claimed} verified`}
        />
        <StatCard label="Instructors" value={stats.instructors} />
        <StatCard
          label="Assignments"
          value={stats.assignments}
          hint={`${stats.pending} awaiting verification`}
        />
        <StatCard
          label="Running tasks"
          value={stats.runningTasks}
          hint={`${stats.scheduledTasks} scheduled`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <Link key={shortcut.title} href={shortcut.href} className="group">
            <Card className="hover:border-foreground/25 h-full transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {shortcut.title}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </CardTitle>
                <CardDescription>{shortcut.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {stats.roster === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No students imported yet — start at{" "}
            <Link href="/admin/students" className="text-foreground underline">
              Students
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
