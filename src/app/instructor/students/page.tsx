import Link from "next/link";

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
import { summariseOthers } from "@/lib/others";
import { requireTeachingSpace } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { getInstructorStudents } from "@/server/instructor-view";

type Tab = "joined" | "not-joined";

const TABS: { value: Tab; label: string }[] = [
  { value: "joined", label: "Joined" },
  { value: "not-joined", label: "Not joined" },
];

function fmt(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function InstructorStudentsPage({
  searchParams,
}: PageProps<"/instructor/students">) {
  const { instructor } = await requireTeachingSpace();

  if (!instructor) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No instructor record yet — ask an admin to finish setting you up.
        </CardContent>
      </Card>
    );
  }

  const params = await searchParams;
  const tab: Tab = params.tab === "not-joined" ? "not-joined" : "joined";

  const { joined, notJoined } = await getInstructorStudents(instructor.id);
  const granted = joined.filter((s) => s.discordSyncedAt).length;

  const exportHref = (format: "xlsx" | "csv") =>
    `/api/export/students?status=${tab}&format=${format}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">My students</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Assignments are made by an admin. Everything here is read-only.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={exportHref("xlsx")}>Export Excel</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={exportHref("csv")}>Export CSV</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/export/students?status=all&format=xlsx">
              Export everything
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Joined"
          value={joined.length}
          hint="verified and assigned"
        />
        <StatCard
          label="Discord access"
          value={granted}
          hint={`${joined.length - granted} still syncing`}
        />
        <StatCard
          label="Not joined"
          value={notJoined.length}
          hint="assigned by email, never verified"
        />
      </div>

      <div className="border-border/60 flex gap-1 border-b">
        {TABS.map((item) => {
          const active = item.value === tab;
          const total = item.value === "joined" ? joined.length : notJoined.length;
          return (
            <Link
              key={item.value}
              href={`/instructor/students?tab=${item.value}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {item.label}
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                {total}
              </span>
            </Link>
          );
        })}
      </div>

      {tab === "joined" ? (
        <Card>
          <CardHeader>
            <CardTitle>Joined</CardTitle>
            <CardDescription>
              Signed in with Discord, verified their course email, and assigned
              to you.
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
                      <TableHead>Verified</TableHead>
                      <TableHead>Discord</TableHead>
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
                        <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                          {summariseOthers(student.others)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmt(student.verifiedAt)}
                        </TableCell>
                        <TableCell>
                          {student.discordSyncedAt ? (
                            <Badge variant="secondary">Access granted</Badge>
                          ) : (
                            <Badge variant="outline">Pending sync</Badge>
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Not joined</CardTitle>
            <CardDescription>
              An admin assigned these course emails, but nobody has signed in
              and verified with them yet. They are added to your channels
              automatically the moment they do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {notJoined.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Everyone assigned to you has joined.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course email</TableHead>
                      <TableHead>Name in list</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>From the sheet</TableHead>
                      <TableHead>Assigned</TableHead>
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
                        <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                          {summariseOthers(student.others)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmt(student.assignedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
