import { count, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { AssignDialog } from "@/app/admin/instructors/assign-dialog";
import {
  RetryProvisionButton,
  RevokeInstructorButton,
} from "@/app/admin/instructors/instructor-actions";
import { PromoteForm } from "@/app/admin/instructors/promote-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/rbac";

export default async function AdminInstructorsPage() {
  await requireRole("admin");

  const [instructors, candidates, pendingCounts] = await Promise.all([
    db
      .select({
        id: schema.instructor.id,
        userId: schema.instructor.userId,
        displayName: schema.instructor.displayName,
        categoryId: schema.instructor.discordCategoryId,
        email: schema.user.email,
        role: schema.user.role,
        students: sql<number>`(
          select count(*)::int from ${schema.studentAssignment}
          where ${schema.studentAssignment.instructorId} = ${schema.instructor.id}
        )`,
        channels: sql<number>`(
          select count(*)::int from ${schema.instructorChannel}
          where ${schema.instructorChannel.instructorId} = ${schema.instructor.id}
        )`,
      })
      .from(schema.instructor)
      .innerJoin(schema.user, eq(schema.instructor.userId, schema.user.id))
      .orderBy(schema.instructor.displayName),
    // Any account without a space is a candidate — including admins, who keep
    // their admin rights when they take a course.
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
      })
      .from(schema.user)
      .where(
        sql`not exists (
          select 1 from ${schema.instructor}
          where ${schema.instructor.userId} = ${schema.user.id}
        )`,
      )
      .orderBy(schema.user.name)
      .limit(200),
    db
      .select({
        instructorId: schema.pendingAssignment.instructorId,
        n: count(),
      })
      .from(schema.pendingAssignment)
      .groupBy(schema.pendingAssignment.instructorId),
  ]);

  const pendingByInstructor = new Map(
    pendingCounts.map((row) => [row.instructorId, row.n]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Instructors</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Promoting an account creates its Discord category, six channels and
          the two roles that carry access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promote an account</CardTitle>
          <CardDescription>
            Only accounts that have signed in with Discord appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoteForm candidates={candidates} />
        </CardContent>
      </Card>

      {instructors.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No instructors yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {instructors.map((instructor) => {
            const pending = pendingByInstructor.get(instructor.id) ?? 0;

            return (
              <Card key={instructor.id}>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-3">
                      {instructor.displayName}
                      {instructor.categoryId ? (
                        <Badge variant="secondary">Discord linked</Badge>
                      ) : (
                        <Badge variant="destructive">Not provisioned</Badge>
                      )}
                      {instructor.role !== "instructor" ? (
                        <Badge variant="outline">
                          {instructor.role === "super_admin"
                            ? "Super admin"
                            : instructor.role === "admin"
                              ? "Admin"
                              : "Student role"}
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {instructor.email}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/instructors/${instructor.id}`}>
                        Manage students
                      </Link>
                    </Button>
                    <AssignDialog
                      instructorId={instructor.id}
                      instructorName={instructor.displayName}
                    />
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`/api/export/students?instructorId=${instructor.id}&status=all&format=xlsx`}
                      >
                        Export
                      </a>
                    </Button>
                    {instructor.categoryId ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${instructor.categoryId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open category
                        </a>
                      </Button>
                    ) : (
                      <RetryProvisionButton instructorId={instructor.id} />
                    )}
                    <RevokeInstructorButton
                      instructorId={instructor.id}
                      instructorName={instructor.displayName}
                    />
                  </div>
                </CardHeader>

                <CardContent>
                  <dl className="border-border/60 grid gap-px border-t pt-4 sm:grid-cols-3">
                    <Stat label="Assigned students" value={instructor.students} />
                    <Stat label="Awaiting verification" value={pending} />
                    <Stat label="Channels" value={instructor.channels} />
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
