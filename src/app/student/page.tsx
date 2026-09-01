import { asc, eq } from "drizzle-orm";

import { RejoinCard } from "@/app/student/rejoin-card";
import { Countdown } from "@/components/countdown";
import { DiscordMarkdown } from "@/components/discord-markdown";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db";
import type { ChannelKey } from "@/db/schema";
import { CHANNEL_LAYOUT } from "@/lib/discord/provision";
import { env } from "@/lib/env";
import { countdownBn, formatDateBn, formatDateTimeBn } from "@/lib/format";
import { requireVerifiedStudent } from "@/lib/rbac";
import { getGuildMembership } from "@/server/discord-sync";
import { listOutline, type OutlineRow } from "@/server/outline";
import { getRunningTasks } from "@/server/tasks";

const CHANNEL_COPY: Record<
  ChannelKey,
  { blurb: string; canPost: boolean; forum?: boolean }
> = {
  announcements: {
    blurb: "কোর্সের সব ঘোষণা এখানে আসবে",
    canPost: false,
  },
  task: { blurb: "এসাইনমেন্ট আর টাস্কের ব্রিফ", canPost: false },
  session: { blurb: "সেশনের নোট, লিংক আর রেকর্ডিং", canPost: false },
  discussion: { blurb: "ব্যাচমেটদের সঙ্গে আলোচনা", canPost: true },
  help: {
    blurb: "আটকে গেলে এখানে পোস্ট করো — প্রতিটি প্রশ্নের জন্য আলাদা পোস্ট",
    canPost: true,
    forum: true,
  },
  resources: { blurb: "পড়ার মেটেরিয়াল আর রেফারেন্স", canPost: false },
};

const CHANNEL_ORDER = CHANNEL_LAYOUT.map((c) => c.key);

export default async function StudentPage() {
  const user = await requireVerifiedStudent();

  const rows = await db
    .select({
      instructorId: schema.instructor.id,
      instructorName: schema.instructor.displayName,
      categoryId: schema.instructor.discordCategoryId,
      assignedAt: schema.studentAssignment.assignedAt,
      syncedAt: schema.studentAssignment.discordSyncedAt,
    })
    .from(schema.studentAssignment)
    .innerJoin(
      schema.instructor,
      eq(schema.studentAssignment.instructorId, schema.instructor.id),
    )
    .where(eq(schema.studentAssignment.studentUserId, user.id))
    .orderBy(asc(schema.studentAssignment.assignedAt));

  const [channels, tasks, outline, membership] = await Promise.all([
    rows.length
      ? db
          .select({
            instructorId: schema.instructorChannel.instructorId,
            key: schema.instructorChannel.key,
            channelId: schema.instructorChannel.discordChannelId,
          })
          .from(schema.instructorChannel)
      : [],
    getRunningTasks(),
    listOutline(),
    // One Discord call per dashboard load, and it degrades to "unknown"
    // rather than blocking the page or crying wolf during an outage.
    getGuildMembership(user.id),
  ]);

  return (
    <div lang="bn" className="space-y-10">
      <header>
        <p className="font-bangla text-muted-foreground text-sm">
          দুর্বার গ্রুপ
        </p>
        <h1 className="font-bangla mt-3 text-3xl font-bold sm:text-4xl">
          স্বাগতম, {user.name}
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-xs">
          {user.courseEmail}
        </p>
      </header>

      {membership === "absent" ? <RejoinCard /> : null}

      {rows.length === 0 ? <AwaitingAssignment /> : null}

      {rows.map((row) => {
        const mine = channels
          .filter((c) => c.instructorId === row.instructorId)
          .sort(
            (a, b) =>
              CHANNEL_ORDER.indexOf(a.key) - CHANNEL_ORDER.indexOf(b.key),
          );

        return (
          <section
            key={row.instructorId}
            className="border-border/70 bg-card/40 relative overflow-hidden rounded-2xl border"
          >
            <div className="hairline absolute inset-x-0 top-0" />

            <div className="flex flex-wrap items-end justify-between gap-6 p-8">
              <div>
                <p className="font-bangla text-muted-foreground text-sm">
                  তোমার ইন্সট্রাক্টর
                </p>
                <h2 className="font-bangla mt-3 text-2xl font-bold">
                  {row.instructorName}
                </h2>
                <p className="font-bangla text-muted-foreground mt-2 text-sm leading-loose">
                  {row.syncedAt
                    ? "ডিসকর্ড অ্যাক্সেস চালু আছে।"
                    : "ডিসকর্ড অ্যাক্সেস সেট করা হচ্ছে — একটু পরে রিফ্রেশ করো।"}
                </p>
              </div>

              {row.categoryId ? (
                <Button
                  asChild
                  className="bg-brand-gradient font-bangla h-11 rounded-full px-6 text-white hover:opacity-90"
                >
                  <a
                    href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${row.categoryId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ডিসকর্ডে যাও
                  </a>
                </Button>
              ) : null}
            </div>

            {mine.length > 0 ? (
              <ul className="border-border/60 grid border-t sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((channel) => {
                  const copy = CHANNEL_COPY[channel.key];
                  return (
                    <li
                      key={channel.channelId}
                      className="border-border/60 min-w-0 border-r border-b last:border-r-0"
                    >
                      <a
                        href={`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel.channelId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:bg-foreground/[0.04] group flex h-full flex-col gap-2 p-6 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-base font-semibold">
                          <span className="text-muted-foreground">#</span>
                          {channel.key}
                          <span
                            aria-hidden
                            className="text-muted-foreground ml-auto transition-transform group-hover:translate-x-0.5"
                          >
                            ↗
                          </span>
                        </span>
                        <span className="font-bangla text-muted-foreground text-sm leading-loose">
                          {copy.blurb}
                        </span>
                        <span className="font-bangla text-muted-foreground/80 mt-auto pt-3 text-xs">
                          {copy.forum
                            ? "ফোরাম · তুমি পোস্ট খুলতে পারবে"
                            : copy.canPost
                              ? "তুমি মেসেজ দিতে পারবে"
                              : "শুধু পড়তে পারবে"}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-border/60 font-bangla text-muted-foreground border-t p-8 text-sm leading-loose">
                এই ইন্সট্রাক্টরের চ্যানেলগুলো এখনো তৈরি হয়নি।
              </p>
            )}
          </section>
        );
      })}

      <RunningTasks tasks={tasks} />

      <CourseOutline items={outline} />
    </div>
  );
}

type RunningTask = {
  id: string;
  title: string;
  body: string;
  dueAt: Date;
};

/**
 * Read-only on purpose: a task here is the same text that went to the #task
 * channel, and nothing on this card is clickable.
 */
function RunningTasks({ tasks }: { tasks: RunningTask[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-bangla text-2xl font-bold">চলমান টাস্ক</h2>
        <span className="font-bangla text-muted-foreground text-sm">
          {tasks.length > 0
            ? `${new Intl.NumberFormat("bn-BD").format(tasks.length)}টি চলছে`
            : null}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="border-border/70 bg-card/40 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-bangla text-muted-foreground text-sm leading-loose">
            এই মুহূর্তে কোনো টাস্ক চলছে না। নতুন টাস্ক দেওয়া হলে এখানে আর
            ডিসকর্ডের #task চ্যানেলে দুই জায়গাতেই দেখতে পাবে।
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="border-border/70 bg-card/40 relative overflow-hidden rounded-2xl border"
            >
              <div className="hairline absolute inset-x-0 top-0" />
              <div className="flex flex-wrap items-start justify-between gap-4 p-8 pb-4">
                <h3 className="font-bangla text-xl font-bold">{task.title}</h3>
                <span className="border-border/70 font-bangla shrink-0 rounded-full border px-3 py-1 text-xs">
                  <Countdown
                    dueAt={task.dueAt}
                    initial={countdownBn(task.dueAt)}
                  />
                </span>
              </div>
              <DiscordMarkdown markdown={task.body} className="px-8" />
              <p className="font-bangla text-muted-foreground border-border/60 mt-6 border-t px-8 py-4 text-xs">
                ডেডলাইন {formatDateTimeBn(task.dueAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


const OUTLINE_LABEL_BN: Record<OutlineRow["state"], string> = {
  upcoming: "আসছে",
  open: "চলছে",
  closed: "শেষ",
};

/**
 * The whole course plan, upcoming entries included — looking ahead is the
 * point of an outline. Read-only, like the task list.
 */
function CourseOutline({ items }: { items: OutlineRow[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-bangla text-2xl font-bold">কোর্স আউটলাইন</h2>
        <span className="font-bangla text-muted-foreground text-sm">
          {items.length > 0
            ? `${new Intl.NumberFormat("bn-BD").format(items.length)}টি ধাপ`
            : null}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="border-border/70 bg-card/40 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-bangla text-muted-foreground text-sm leading-loose">
            আউটলাইন এখনো যোগ করা হয়নি। কোর্সের ধাপগুলো ঠিক হলে কবে কী হবে তার
            পুরো তালিকা এখানে দেখতে পাবে।
          </p>
        </div>
      ) : (
        <ol className="border-border/70 bg-card/40 divide-border/60 divide-y overflow-hidden rounded-2xl border">
          {items.map((item) => (
            <li
              key={item.id}
              className={
                item.state === "closed"
                  ? "flex flex-wrap items-center gap-x-6 gap-y-2 p-6 opacity-60"
                  : "flex flex-wrap items-center gap-x-6 gap-y-2 p-6"
              }
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bangla text-base font-semibold">
                  {item.title}
                </h3>
                <p className="font-bangla text-muted-foreground mt-1 text-sm leading-loose">
                  {formatDateBn(item.releasedAt)}
                  {item.dueAt
                    ? ` · ডেডলাইন ${formatDateTimeBn(item.dueAt)}`
                    : ""}
                </p>
              </div>
              <span className="border-border/70 font-bangla shrink-0 rounded-full border px-3 py-1 text-xs">
                {item.state === "open" && item.dueAt ? (
                  <Countdown dueAt={item.dueAt} initial={countdownBn(item.dueAt)} />
                ) : (
                  OUTLINE_LABEL_BN[item.state]
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AwaitingAssignment() {
  return (
    <section className="border-border/70 bg-card/40 rounded-2xl border border-dashed p-10 text-center">
      <h2 className="font-bangla text-xl font-semibold">
        ভেরিফাই হয়ে গেছে — এখন ইন্সট্রাক্টর অ্যাসাইন হওয়ার অপেক্ষা
      </h2>
      <p className="font-bangla text-muted-foreground mx-auto mt-4 max-w-md text-sm leading-loose">
        অ্যাডমিন ধাপে ধাপে শিক্ষার্থীদের ইন্সট্রাক্টরের সঙ্গে অ্যাসাইন করেন।
        অ্যাসাইন হওয়ার সঙ্গে সঙ্গেই তোমার ডিসকর্ড চ্যানেলগুলো এখানে দেখা যাবে
        এবং সার্ভারে অ্যাক্সেস চালু হয়ে যাবে।
      </p>
    </section>
  );
}
