import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignDialog } from "@/app/admin/instructors/assign-dialog";
import { RetryProvisionButton } from "@/app/admin/instructors/instructor-actions";
import {
  ResyncButton,
  TransferButton,
  UnassignButton,
  WithdrawPendingButton,
} from "@/app/admin/instructors/student-row-actions";
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
import { summariseOthers } from "@/lib/others";
import { requireRole } from "@/lib/rbac";
import { listInstructorOptions } from "@/server/instructors";
import {
  getInstructorById,
  getInstructorStudents,
} from "@/server/instructor-view";

function fmt(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function AdminInstructorDetailPage({
  params,
}: PageProps<"/admin/instructors/[id]">) {
  await requireRole("admin");

  const { id } = await params;
  const instructor = await getInstructorById(id);
  if (!instructor) notFound();

  const [{ joined, notJoined }, instructors] = await Promise.all([
    getInstructorStudents(instructor.id),
    listInstructorOptions(),
  ]);
  const granted = joined.filter((s) => s.discordSyncedAt).length;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/instructors"
          className="text-muted-foreground hover:text-foreground font-mono text-xs"
        >
          ← All instructors
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading flex flex-wrap items-center gap-3 text-2xl font-bold">
              {instructor.displayName}
              {instructor.discordCategoryId ? (
                <Badge variant="secondary">Discord linked</Badge>
              ) : (
                <Badge variant="destructive">Not provisioned</Badge>
              )}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <AssignDialog
              instructorId={instructor.id}
              instructorName={instructor.displayName}
            />
            <Button asChild size="sm" variant="outline">
              <a
                href={`/api/export/students?instructorId=${instructor.id}&status=all&format=xlsx`}
              >
                Export Excel
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a
                href={`/api/export/students?instructorId=${instructor.id}&status=all&format=csv`}
              >
                Export CSV
              </a>
            </Button>
            {instructor.discordCategoryId ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${instructor.discordCategoryId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open category
                </a>
              </Button>
            ) : (
              <RetryProvisionButton instructorId={instructor.id} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Joined" value={joined.length} />
        <StatCard
          label="Discord access"
          value={granted}
          hint={`${joined.length - granted} not synced`}
        />
        <StatCard label="Not joined" value={notJoined.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Joined</CardTitle>
          <CardDescription>
            Verified their course email and assigned to this instructor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {joined.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nobody has joined yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>From the sheet</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Discord</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {joined.map((student) => (
                    <TableRow key={student.userId}>
                      <TableCell>
                        <span className="block font-medium">
                          {student.name}
                        </span>
                        <span className="text-muted-foreground block font-mono text-xs">
                          {student.courseEmail}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {student.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-56 truncate text-xs">
                        {summariseOthers(student.others)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmt(student.assignedAt)}
                      </TableCell>
                      <TableCell>
                        {student.discordSyncedAt ? (
                          <Badge variant="secondary">Granted</Badge>
                        ) : (
                          <Badge variant="outline">Not synced</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <ResyncButton studentUserId={student.userId} />
                          <TransferButton
                            fromInstructorId={instructor.id}
                            instructors={instructors}
                            label={student.name}
                            studentUserId={student.userId}
                          />
                          <UnassignButton
                            studentUserId={student.userId}
                            instructorId={instructor.id}
                            studentName={student.name}
                            instructorName={instructor.displayName}
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

      <Card>
        <CardHeader>
          <CardTitle>Not joined</CardTitle>
          <CardDescription>
            Assigned by email. These become real assignments the moment the
            student signs in and verifies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notJoined.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nothing pending.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course email</TableHead>
                    <TableHead>Name in list</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notJoined.map((student) => (
                    <TableRow key={student.courseEmail}>
                      <TableCell className="font-mono text-xs">
                        {student.courseEmail}
                        {!student.onRoster ? (
                          <Badge variant="destructive" className="ml-2">
                            Not in the list
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{student.rosterName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {student.phone ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmt(student.assignedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <TransferButton
                            fromInstructorId={instructor.id}
                            instructors={instructors}
                            label={student.courseEmail}
                            courseEmail={student.courseEmail}
                          />
                          <WithdrawPendingButton
                            courseEmail={student.courseEmail}
                            instructorId={instructor.id}
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
