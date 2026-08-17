import { count, desc, ilike, or } from "drizzle-orm";
import Link from "next/link";

import { BanButton, RoleSelect } from "@/app/admin/users/user-row-actions";
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
import type { Role } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const admin = await requireRole("admin");
  const isSuperAdmin = admin.role === "super_admin";

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const filter = q
    ? or(
        ilike(schema.user.email, `%${q}%`),
        ilike(schema.user.name, `%${q}%`),
        ilike(schema.user.courseEmail, `%${q}%`),
      )
    : undefined;

  const [users, [totals]] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        courseEmail: schema.user.courseEmail,
        role: schema.user.role,
        studentVerified: schema.user.studentVerified,
        banned: schema.user.banned,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(filter)
      .orderBy(desc(schema.user.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(schema.user).where(filter),
  ]);

  const pageCount = Math.max(1, Math.ceil(totals.n / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isSuperAdmin
            ? "You are a super admin: you can grant and revoke admin access."
            : "Only a super admin can grant or revoke admin access."}{" "}
          Changing a role to instructor provisions their Discord space; moving
          them off instructor tears it down.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>{totals.n} total</CardDescription>
          <CardAction>
            <form className="flex gap-2">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search name or email"
                className="sm:w-64"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Course email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === admin.id;
                  // An admin may not touch another admin; a super admin may.
                  const targetPrivileged =
                    user.role === "admin" || user.role === "super_admin";
                  const locked =
                    isSelf || (!isSuperAdmin && targetPrivileged);

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className="block font-medium">{user.name}</span>
                        <span className="text-muted-foreground block font-mono text-xs">
                          {user.email}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {user.courseEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {user.studentVerified ? (
                            <Badge variant="secondary">Verified</Badge>
                          ) : null}
                          {user.banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : null}
                          {isSelf ? <Badge variant="outline">You</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleSelect
                          userId={user.id}
                          role={user.role as Role}
                          disabled={locked}
                          canGrantAdmin={isSuperAdmin}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <BanButton
                          userId={user.id}
                          userName={user.name}
                          banned={user.banned}
                          disabled={locked}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 ? (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-muted-foreground font-mono text-xs">
                page {page} / {pageCount}
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" disabled={page <= 1}>
                  <Link
                    href={`/admin/users?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  >
                    Previous
                  </Link>
                </Button>
                <Button asChild variant="outline" disabled={page >= pageCount}>
                  <Link
                    href={`/admin/users?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
