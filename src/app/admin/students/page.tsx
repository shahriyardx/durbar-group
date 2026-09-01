import { count, desc, eq, isNotNull, sql } from "drizzle-orm";
import Link from "next/link";

import { AddStudentForm } from "@/app/admin/students/add-student-form";
import { ImportForm } from "@/app/admin/students/import-form";
import {
  DeleteStudentButton,
  EliminateStudentButton,
  RestoreStudentButton,
  RevokeVerificationButton,
} from "@/app/admin/students/student-actions";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db, schema } from "@/db";
import { summariseOthers } from "@/lib/others";
import { requireRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  importedStudentFilter,
  instructorsForUsers,
  isVerificationStatus,
  type AssignedInstructor,
  type VerificationStatus,
} from "@/server/imported-students";

const PAGE_SIZE = 50;

const STATUS_TABS: { value: VerificationStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Not verified" },
  { value: "eliminated", label: "Eliminated" },
];

const STATUS_TITLE: Record<VerificationStatus, string> = {
  all: "All students",
  verified: "Verified students",
  unverified: "Not verified yet",
  eliminated: "Eliminated from the group",
};

/**
 * A student can sit with more than one instructor, so this renders a list.
 * "Not assigned" and "Not verified" are different states worth telling apart:
 * only a verified student is waiting on an admin to assign them.
 */
function InstructorLinks({
  instructors,
  verified,
}: {
  instructors: AssignedInstructor[];
  verified: boolean;
}) {
  if (instructors.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {verified ? "Not assigned" : "—"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {instructors.map((instructor) => (
        <Link
          key={instructor.id}
          href={`/admin/instructors/${instructor.id}`}
          className="hover:text-foreground text-sm underline underline-offset-2"
        >
          {instructor.displayName}
        </Link>
      ))}
    </div>
  );
}

export default async function AdminStudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  await requireRole("admin");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    typeof params.status === "string" && isVerificationStatus(params.status)
      ? params.status
      : "all";

  const filter = importedStudentFilter(status, q);

  const [rows, [totals], [grand], [claimedRow], [eliminatedRow]] =
    await Promise.all([
    db
      .select({
        id: schema.importedStudent.id,
        email: schema.importedStudent.email,
        name: schema.importedStudent.name,
        phone: schema.importedStudent.phone,
        others: schema.importedStudent.others,
        importedAt: schema.importedStudent.importedAt,
        claimedByUserId: schema.importedStudent.claimedByUserId,
        claimedName: schema.user.name,
        eliminated: schema.user.eliminated,
        eliminationReason: schema.user.eliminationReason,
      })
      .from(schema.importedStudent)
      .leftJoin(
        schema.user,
        sql`${schema.user.id} = ${schema.importedStudent.claimedByUserId}`,
      )
      .where(filter)
      .orderBy(desc(schema.importedStudent.importedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    // The join is not decoration: the "eliminated" filter reads user.eliminated,
    // so counting without it would be a missing-FROM-clause error.
    db
      .select({ n: count() })
      .from(schema.importedStudent)
      .leftJoin(
        schema.user,
        sql`${schema.user.id} = ${schema.importedStudent.claimedByUserId}`,
      )
      .where(filter),
    // Unfiltered, so the cards keep describing the whole cohort while the
    // table below is narrowed to a tab.
    db.select({ n: count() }).from(schema.importedStudent),
    db
      .select({ n: count() })
      .from(schema.importedStudent)
      .where(isNotNull(schema.importedStudent.claimedByUserId)),
    db
      .select({ n: count() })
      .from(schema.importedStudent)
      .innerJoin(
        schema.user,
        sql`${schema.user.id} = ${schema.importedStudent.claimedByUserId}`,
      )
      .where(eq(schema.user.eliminated, true)),
  ]);

  // Only claimed rows can carry an assignment, and only this page's worth.
  const instructorsByUser = await instructorsForUsers(
    rows.map((row) => row.claimedByUserId).filter((id): id is string => !!id),
  );

  const pageCount = Math.max(1, Math.ceil(totals.n / PAGE_SIZE));
  const href = (next: Partial<{ status: string; q: string; page: number }>) => {
    const search = new URLSearchParams();
    const merged = { status, q, page: 1, ...next };
    if (merged.status !== "all") search.set("status", merged.status);
    if (merged.q) search.set("q", merged.q);
    if (merged.page > 1) search.set("page", String(merged.page));
    const query = search.toString();
    return query ? `/admin/students?${query}` : "/admin/students";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Students</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Students imported from your course export. An entry here only proves
          enrolment — assigning them to an instructor happens on the
          instructors page.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Imported students" value={grand.n} />
        <StatCard label="Verified" value={claimedRow.n} />
        <StatCard label="Not verified" value={grand.n - claimedRow.n} />
        <StatCard
          label="Eliminated"
          value={eliminatedRow.n}
          hint={eliminatedRow.n ? "locked out of Discord and the app" : undefined}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Import from Excel</CardTitle>
            <CardDescription>
              Re-uploading is safe: rows are matched on email, existing entries
              are updated, and a blank cell never wipes existing data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add one student</CardTitle>
            <CardDescription>
              For the late enrolment that never made it into a sheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddStudentForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STATUS_TITLE[status]}</CardTitle>
          <CardDescription>
            {totals.n} {q ? "matching" : ""} students
          </CardDescription>
          {/* CardHeader is a grid, not a flex row — CardAction is the slot it
              reserves on the right, so a header control belongs in it. */}
          <CardAction>
            <form className="flex gap-2">
              {status === "all" ? null : (
                <input type="hidden" name="status" value={status} />
              )}
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search email, name or phone"
                className="sm:w-64"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="border-border/70 flex rounded-full border p-1">
              {STATUS_TABS.map((tab) => (
                <Link
                  key={tab.value}
                  href={href({ status: tab.value })}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors",
                    tab.value === status
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Export this list
              </span>
              {(["xlsx", "csv"] as const).map((format) => (
                <Button key={format} asChild size="sm" variant="outline">
                  <a
                    href={`/api/export/imported-students?status=${status}&format=${format}${
                      q ? `&q=${encodeURIComponent(q)}` : ""
                    }`}
                  >
                    {format.toUpperCase()}
                  </a>
                </Button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {q
                ? "No students match that search."
                : status === "verified"
                  ? "Nobody has verified yet."
                  : status === "unverified"
                    ? "Everybody imported has verified."
                    : status === "eliminated"
                      ? "Nobody has been eliminated."
                      : "No students imported yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Other columns</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.email}
                      </TableCell>
                      <TableCell>{row.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.phone ?? "—"}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground max-w-64 truncate text-xs"
                        title={summariseOthers(row.others)}
                      >
                        {summariseOthers(row.others)}
                      </TableCell>
                      <TableCell>
                        <InstructorLinks
                          instructors={
                            row.claimedByUserId
                              ? (instructorsByUser.get(row.claimedByUserId) ??
                                [])
                              : []
                          }
                          verified={Boolean(row.claimedByUserId)}
                        />
                      </TableCell>
                      <TableCell>
                        {row.eliminated ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/50 text-destructive"
                            title={row.eliminationReason ?? undefined}
                          >
                            Eliminated · {row.claimedName}
                          </Badge>
                        ) : row.claimedByUserId ? (
                          <Badge variant="secondary">
                            Verified · {row.claimedName}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not verified</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          {row.claimedByUserId ? (
                            row.eliminated ? (
                              <RestoreStudentButton
                                studentUserId={row.claimedByUserId}
                                studentName={row.claimedName ?? row.email}
                              />
                            ) : (
                              <>
                                <EliminateStudentButton
                                  studentUserId={row.claimedByUserId}
                                  studentName={row.claimedName ?? row.email}
                                />
                                <RevokeVerificationButton
                                  studentUserId={row.claimedByUserId}
                                  studentName={row.claimedName ?? row.email}
                                  courseEmail={row.email}
                                />
                              </>
                            )
                          ) : null}
                          <DeleteStudentButton
                            id={row.id}
                            email={row.email}
                            claimed={Boolean(row.claimedByUserId)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pageCount > 1 ? (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-muted-foreground font-mono text-xs">
                page {page} / {pageCount}
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" disabled={page <= 1}>
                  <Link href={href({ page: page - 1 })}>Previous</Link>
                </Button>
                <Button asChild variant="outline" disabled={page >= pageCount}>
                  <Link href={href({ page: page + 1 })}>Next</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
