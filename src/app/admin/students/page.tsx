import { count, desc, ilike, isNotNull, or, sql } from "drizzle-orm";
import Link from "next/link";

import { ImportForm } from "@/app/admin/students/import-form";
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

const PAGE_SIZE = 50;

export default async function AdminStudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  await requireRole("admin");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const filter = q
    ? or(
        ilike(schema.importedStudent.email, `%${q}%`),
        ilike(schema.importedStudent.name, `%${q}%`),
        ilike(schema.importedStudent.phone, `%${q}%`),
      )
    : undefined;

  const [rows, [totals], [claimedRow]] = await Promise.all([
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
    db.select({ n: count() }).from(schema.importedStudent).where(filter),
    db
      .select({ n: count() })
      .from(schema.importedStudent)
      .where(isNotNull(schema.importedStudent.claimedByUserId)),
  ]);

  const pageCount = Math.max(1, Math.ceil(totals.n / PAGE_SIZE));

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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Imported students" value={totals.n} />
        <StatCard label="Verified" value={claimedRow.n} />
        <StatCard label="Unclaimed" value={totals.n - claimedRow.n} />
      </div>

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
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All students</CardTitle>
            <CardDescription>
              {totals.n} {q ? "matching" : "total"} students
            </CardDescription>
          </div>
          <form className="flex gap-2">
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
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {q
                ? "No students match that search."
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
                    <TableHead>Status</TableHead>
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
                        {row.claimedByUserId ? (
                          <Badge variant="secondary">
                            Verified · {row.claimedName}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unclaimed</Badge>
                        )}
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
                  <Link
                    href={`/admin/students?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  >
                    Previous
                  </Link>
                </Button>
                <Button asChild variant="outline" disabled={page >= pageCount}>
                  <Link
                    href={`/admin/students?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  >
                    Next
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
