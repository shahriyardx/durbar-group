import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/db";
import type { ChannelKey } from "@/db/schema";
import { CHANNEL_LAYOUT } from "@/lib/discord/provision";
import { env } from "@/lib/env";
import { requireTeachingSpace } from "@/lib/rbac";
import { getInstructorStudents } from "@/server/instructor-view";

const CHANNEL_ORDER = CHANNEL_LAYOUT.map((c) => c.key);
const CAN_POST = new Set<ChannelKey>(
  CHANNEL_LAYOUT.filter((c) => c.studentsCanPost).map((c) => c.key),
);
const FORUMS = new Set<ChannelKey>(
  CHANNEL_LAYOUT.filter((c) => c.forum).map((c) => c.key),
);

export default async function InstructorPage() {
  const { instructor } = await requireTeachingSpace();

  if (!instructor) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No Discord space has been provisioned for you yet. An admin can do it
          from the instructors page.
        </CardContent>
      </Card>
    );
  }

  const [{ joined, notJoined }, channels] = await Promise.all([
    getInstructorStudents(instructor.id),
    db
      .select({
        key: schema.instructorChannel.key,
        channelId: schema.instructorChannel.discordChannelId,
      })
      .from(schema.instructorChannel)
      .where(eq(schema.instructorChannel.instructorId, instructor.id))
      .orderBy(asc(schema.instructorChannel.createdAt)),
  ]);

  const granted = joined.filter((s) => s.discordSyncedAt).length;
  const ordered = [...channels].sort(
    (a, b) => CHANNEL_ORDER.indexOf(a.key) - CHANNEL_ORDER.indexOf(b.key),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {instructor.displayName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {instructor.discordCategoryId
              ? "Your Discord category is live."
              : "Discord category not provisioned yet — ask an admin."}
          </p>
        </div>

        {instructor.discordCategoryId ? (
          <Button
            asChild
            className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
          >
            <a
              href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${instructor.discordCategoryId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Discord
            </a>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Joined" value={joined.length} />
        <StatCard
          label="Discord access"
          value={granted}
          hint={`${joined.length - granted} syncing`}
        />
        <StatCard label="Not joined" value={notJoined.length} />
        <StatCard label="Channels" value={ordered.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>
            {joined.length} joined · {notJoined.length} still to verify
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/instructor/students">Open the list</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your channels</CardTitle>
          <CardDescription>
            You have full control of every channel here. Students can only post
            in discussion, and open posts in the help forum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No channels provisioned yet.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {ordered.map((channel) => (
                <li key={channel.channelId}>
                  <a
                    href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel.channelId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:bg-foreground/[0.04] group flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-colors"
                  >
                    <span className="text-muted-foreground">#</span>
                    <span className="font-medium">{channel.key}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {FORUMS.has(channel.key)
                        ? "forum · students open posts"
                        : CAN_POST.has(channel.key)
                          ? "students can post"
                          : "students read only"}
                    </span>
                    <span
                      aria-hidden
                      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    >
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
