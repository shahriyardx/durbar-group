import { asc, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { db, schema } from "@/db";
import type { ChannelKey } from "@/db/schema";
import { CHANNEL_LAYOUT } from "@/lib/discord/provision";
import { env } from "@/lib/env";
import { requireVerifiedStudent } from "@/lib/rbac";

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

  const channels = rows.length
    ? await db
        .select({
          instructorId: schema.instructorChannel.instructorId,
          key: schema.instructorChannel.key,
          channelId: schema.instructorChannel.discordChannelId,
        })
        .from(schema.instructorChannel)
    : [];

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
    </div>
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
