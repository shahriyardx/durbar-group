import { createOutlineAction } from "@/app/admin/outline/actions";
import {
  DeleteOutlineButton,
  EditOutlineButton,
} from "@/app/admin/outline/outline-actions";
import { OutlineForm } from "@/app/admin/outline/outline-form";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
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
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { listOutline, type OutlineState } from "@/server/outline";

export default async function AdminOutlinePage() {
  await requireRole("admin");
  const items = await listOutline();

  const upcoming = items.filter((i) => i.state === "upcoming");
  const open = items.filter((i) => i.state === "open");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Outline</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          The course plan: what happens when. Every student sees the whole
          outline on their dashboard, in release order, so they can look ahead.
          Unlike a task, an outline entry is never posted to Discord.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Outline entries" value={items.length} />
        <StatCard label="Open now" value={open.length} />
        <StatCard label="Still upcoming" value={upcoming.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add an entry</CardTitle>
          <CardDescription>
            A title, the day it opens, and a deadline if it has one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OutlineForm
            action={createOutlineAction}
            submitLabel="Add to outline"
            resetOnSuccess
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The outline</CardTitle>
          <CardDescription>Earliest release date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Nothing in the outline yet — add the first entry above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-80 font-medium">
                        {item.title}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDate(item.releasedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.dueAt ? formatDateTime(item.dueAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <StateBadge state={item.state} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <EditOutlineButton
                            item={{
                              id: item.id,
                              title: item.title,
                              releasedAt: item.releasedAt,
                              dueAt: item.dueAt,
                            }}
                          />
                          <DeleteOutlineButton
                            itemId={item.id}
                            title={item.title}
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

const STATE_LABEL: Record<OutlineState, string> = {
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
};

function StateBadge({ state }: { state: OutlineState }) {
  return (
    <Badge variant={state === "open" ? "secondary" : "outline"}>
      {STATE_LABEL[state]}
    </Badge>
  );
}
