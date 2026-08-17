import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { db, pool, schema } from "@/db";
import {
  createMessage,
  deleteMessage,
  editMessage,
} from "@/lib/discord/messages";
import {
  DISCORD_MESSAGE_LIMIT,
  escapeDiscordText,
} from "@/lib/markdown/discord";

/** One publisher at a time across the whole app, cron included. */
const PUBLISH_LOCK = 728_412_002;

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give the task a title.").max(180),
    body: z.string().trim().min(1, "Write the task description."),
    // Optional in the form: an empty start means "starts now".
    startsAt: z.date().nullable(),
    dueAt: z.date(),
  })
  .refine((value) => !value.startsAt || value.dueAt > value.startsAt, {
    path: ["dueAt"],
    message: "The deadline has to be after the start.",
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

export async function createTask(input: TaskInput, adminId: string) {
  const now = new Date();
  const [row] = await db
    .insert(schema.task)
    .values({
      title: input.title,
      body: input.body,
      startsAt: input.startsAt ?? now,
      dueAt: input.dueAt,
      createdBy: adminId,
    })
    .returning();
  return row;
}

/**
 * Save the edit, then rewrite the copies Discord already has so the two never
 * disagree. Discord does not re-notify on an edit, so nobody is pinged twice.
 */
export async function updateTask(taskId: string, input: TaskInput) {
  const [row] = await db
    .update(schema.task)
    .set({
      title: input.title,
      body: input.body,
      startsAt: input.startsAt ?? undefined,
      dueAt: input.dueAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.task.id, taskId))
    .returning();

  if (!row) return null;
  return { ...row, discord: await editTaskMessages(row) };
}

/**
 * Cancelling pulls the task out of Discord as well as off the dashboard, and
 * forgets the deliveries, so restoring it posts a fresh set rather than
 * leaving orphaned messages behind.
 */
export async function setTaskStatus(
  taskId: string,
  status: "scheduled" | "cancelled",
) {
  const removed =
    status === "cancelled" ? await deleteTaskMessages(taskId) : null;

  if (status === "cancelled") {
    await db.delete(schema.taskPost).where(eq(schema.taskPost.taskId, taskId));
  }

  await db
    .update(schema.task)
    .set({
      status,
      publishedAt: status === "cancelled" ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.task.id, taskId));

  return removed;
}

/**
 * Row only. Call `deleteTaskMessages` first and stop if it reports failures —
 * once this row is gone, so is the record of where those messages live.
 */
export async function deleteTask(taskId: string) {
  await db.delete(schema.task).where(eq(schema.task.id, taskId));
}

/** Every delivery of a task that actually made it to Discord. */
function deliveredPosts(taskId: string) {
  return db
    .select({
      id: schema.taskPost.id,
      channelId: schema.taskPost.discordChannelId,
      messageId: schema.taskPost.discordMessageId,
      studentRoleId: schema.instructor.discordStudentRoleId,
    })
    .from(schema.taskPost)
    .innerJoin(
      schema.instructor,
      eq(schema.taskPost.instructorId, schema.instructor.id),
    )
    .where(
      and(
        eq(schema.taskPost.taskId, taskId),
        isNotNull(schema.taskPost.postedAt),
        isNotNull(schema.taskPost.discordMessageId),
      ),
    );
}

export type DiscordSyncSummary = { changed: number; failed: number };

export async function editTaskMessages(task: {
  id: string;
  title: string;
  body: string;
  startsAt: Date;
  dueAt: Date;
}): Promise<DiscordSyncSummary> {
  const posts = await deliveredPosts(task.id);
  let changed = 0;
  let failed = 0;

  for (const post of posts) {
    if (!post.channelId || !post.messageId) continue;
    try {
      await editMessage(
        post.channelId,
        post.messageId,
        buildTaskMessage(task, post.studentRoleId),
        post.studentRoleId ? [post.studentRoleId] : [],
      );
      changed++;
      await db
        .update(schema.taskPost)
        .set({ error: null, updatedAt: new Date() })
        .where(eq(schema.taskPost.id, post.id));
    } catch (error) {
      failed++;
      await db
        .update(schema.taskPost)
        .set({ error: reasonOf(error), updatedAt: new Date() })
        .where(eq(schema.taskPost.id, post.id));
    }
  }

  return { changed, failed };
}

export async function deleteTaskMessages(
  taskId: string,
): Promise<DiscordSyncSummary> {
  const posts = await deliveredPosts(taskId);
  let changed = 0;
  let failed = 0;

  for (const post of posts) {
    if (!post.channelId || !post.messageId) continue;
    try {
      await deleteMessage(post.channelId, post.messageId);
      changed++;
    } catch (error) {
      failed++;
      await db
        .update(schema.taskPost)
        .set({ error: reasonOf(error), updatedAt: new Date() })
        .where(eq(schema.taskPost.id, post.id));
    }
  }

  return { changed, failed };
}

function reasonOf(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
}

/** Move the start to now so the next publish run picks the task up. */
export async function startTaskNow(taskId: string) {
  await db
    .update(schema.task)
    .set({ startsAt: new Date(), status: "scheduled", updatedAt: new Date() })
    .where(eq(schema.task.id, taskId));
}

/**
 * Where a task sits in its own lifecycle. Derived rather than stored, and
 * derived here rather than in a component: `Date.now()` during render is
 * exactly the impurity the React compiler rejects.
 */
export type TaskState = "cancelled" | "scheduled" | "running" | "closed";

export function taskState(
  task: { status: string; startsAt: Date; dueAt: Date },
  now: Date = new Date(),
): TaskState {
  if (task.status === "cancelled") return "cancelled";
  if (task.startsAt > now) return "scheduled";
  if (task.dueAt < now) return "closed";
  return "running";
}

export async function getTask(taskId: string) {
  const [row] = await db
    .select()
    .from(schema.task)
    .where(eq(schema.task.id, taskId))
    .limit(1);
  return row ? { ...row, state: taskState(row) } : null;
}

export type TaskListRow = typeof schema.task.$inferSelect & {
  state: TaskState;
  delivered: number;
  failed: number;
};

export async function listTasks(): Promise<TaskListRow[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.task)
    .orderBy(desc(schema.task.startsAt));

  if (rows.length === 0) return [];

  const posts = await db
    .select({
      taskId: schema.taskPost.taskId,
      delivered: sql<number>`count(*) filter (where ${schema.taskPost.postedAt} is not null)::int`,
      failed: sql<number>`count(*) filter (where ${schema.taskPost.postedAt} is null and ${schema.taskPost.error} is not null)::int`,
    })
    .from(schema.taskPost)
    .where(
      inArray(
        schema.taskPost.taskId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(schema.taskPost.taskId);

  const byTask = new Map(posts.map((p) => [p.taskId, p]));
  return rows.map((row) => ({
    ...row,
    state: taskState(row, now),
    delivered: byTask.get(row.id)?.delivered ?? 0,
    failed: byTask.get(row.id)?.failed ?? 0,
  }));
}

export async function getTaskDeliveries(taskId: string) {
  return db
    .select({
      instructorId: schema.taskPost.instructorId,
      instructorName: schema.instructor.displayName,
      channelId: schema.taskPost.discordChannelId,
      messageId: schema.taskPost.discordMessageId,
      postedAt: schema.taskPost.postedAt,
      error: schema.taskPost.error,
      attempts: schema.taskPost.attempts,
    })
    .from(schema.taskPost)
    .innerJoin(
      schema.instructor,
      eq(schema.taskPost.instructorId, schema.instructor.id),
    )
    .where(eq(schema.taskPost.taskId, taskId))
    .orderBy(asc(schema.instructor.displayName));
}

/** Tasks a student should see on their dashboard right now. */
export async function getRunningTasks() {
  const now = new Date();
  return db
    .select({
      id: schema.task.id,
      title: schema.task.title,
      body: schema.task.body,
      dueAt: schema.task.dueAt,
    })
    .from(schema.task)
    .where(
      and(
        ne(schema.task.status, "cancelled"),
        lte(schema.task.startsAt, now),
        gte(schema.task.dueAt, now),
      ),
    )
    .orderBy(asc(schema.task.dueAt));
}

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

/**
 * The exact message that goes to a #task channel. Discord's `<t:…>` stamps
 * render in each student's own timezone, which is worth more than any string
 * we could format server-side.
 */
export function buildTaskMessage(
  task: { title: string; body: string; startsAt: Date; dueAt: Date },
  studentRoleId: string | null,
) {
  const mention = studentRoleId ? `<@&${studentRoleId}>\n` : "";
  const heading = `## ${escapeDiscordText(task.title)}\n`;
  const footer = `\n\n-# শুরু <t:${unix(task.startsAt)}:f> · ডেডলাইন <t:${unix(
    task.dueAt,
  )}:F> (<t:${unix(task.dueAt)}:R>)`;

  const room = DISCORD_MESSAGE_LIMIT - mention.length - heading.length - footer.length;
  let body = task.body;
  if (body.length > room) {
    // Cut on a line boundary so a truncated message never ends mid-fence.
    body = body.slice(0, room - 2);
    body = body.slice(0, Math.max(0, body.lastIndexOf("\n"))) + "\n…";
  }

  return `${mention}${heading}${body}${footer}`;
}

export type PublishSummary = {
  /** False when another publish run already held the lock. */
  ran: boolean;
  tasks: number;
  posted: number;
  failed: number;
};

async function withPublishLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await pool.connect();
  try {
    const held = await client.query<{ ok: boolean }>(
      "select pg_try_advisory_lock($1) as ok",
      [PUBLISH_LOCK],
    );
    if (!held.rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [PUBLISH_LOCK]);
    }
  } finally {
    client.release();
  }
}

/**
 * Fan a task out to every instructor's #task channel.
 *
 * Delivery is tracked per (task, instructor) in `task_post`, so this is safe
 * to run as often as you like: a row that already has `postedAt` is never
 * posted twice, and a row that failed is retried on the next run. A task only
 * flips to `published` once every instructor has it, which is also what makes
 * an instructor created after the fact still receive a task that is running.
 */
export async function publishDueTasks(taskId?: string): Promise<PublishSummary> {
  const result = await withPublishLock(async () => {
    const now = new Date();

    const due = await db
      .select()
      .from(schema.task)
      .where(
        and(
          ne(schema.task.status, "cancelled"),
          lte(schema.task.startsAt, now),
          // Already-published tasks come back only while they are still
          // running, so a new instructor gets backfilled but nobody is
          // spammed with a task whose deadline has passed.
          sql`(${schema.task.status} = 'scheduled' or ${schema.task.dueAt} >= now())`,
          taskId ? eq(schema.task.id, taskId) : undefined,
        ),
      )
      .orderBy(asc(schema.task.startsAt));

    if (due.length === 0) return { ran: true, tasks: 0, posted: 0, failed: 0 };

    const targets = await db
      .select({
        instructorId: schema.instructor.id,
        studentRoleId: schema.instructor.discordStudentRoleId,
        channelId: schema.instructorChannel.discordChannelId,
      })
      .from(schema.instructor)
      .innerJoin(
        schema.instructorChannel,
        and(
          eq(schema.instructorChannel.instructorId, schema.instructor.id),
          eq(schema.instructorChannel.key, "task"),
        ),
      );

    const existing = await db
      .select({
        taskId: schema.taskPost.taskId,
        instructorId: schema.taskPost.instructorId,
        postedAt: schema.taskPost.postedAt,
      })
      .from(schema.taskPost)
      .where(
        inArray(
          schema.taskPost.taskId,
          due.map((t) => t.id),
        ),
      );

    const delivered = new Set(
      existing
        .filter((row) => row.postedAt)
        .map((row) => `${row.taskId}:${row.instructorId}`),
    );

    let posted = 0;
    let failed = 0;

    for (const task of due) {
      for (const target of targets) {
        if (delivered.has(`${task.id}:${target.instructorId}`)) continue;

        const base = {
          taskId: task.id,
          instructorId: target.instructorId,
          discordChannelId: target.channelId,
        };

        try {
          const message = await createMessage(
            target.channelId,
            buildTaskMessage(task, target.studentRoleId),
            target.studentRoleId ? [target.studentRoleId] : [],
          );
          posted++;
          delivered.add(`${task.id}:${target.instructorId}`);
          await db
            .insert(schema.taskPost)
            .values({
              ...base,
              discordMessageId: message.id,
              postedAt: new Date(),
              error: null,
              attempts: 1,
            })
            .onConflictDoUpdate({
              target: [schema.taskPost.taskId, schema.taskPost.instructorId],
              set: {
                discordChannelId: target.channelId,
                discordMessageId: message.id,
                postedAt: new Date(),
                error: null,
                attempts: sql`${schema.taskPost.attempts} + 1`,
                updatedAt: new Date(),
              },
            });
        } catch (error) {
          failed++;
          const reason =
            error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
          await db
            .insert(schema.taskPost)
            .values({ ...base, error: reason, attempts: 1 })
            .onConflictDoUpdate({
              target: [schema.taskPost.taskId, schema.taskPost.instructorId],
              set: {
                discordChannelId: target.channelId,
                error: reason,
                attempts: sql`${schema.taskPost.attempts} + 1`,
                updatedAt: new Date(),
              },
            });
        }
      }

      const complete = targets.every((t) =>
        delivered.has(`${task.id}:${t.instructorId}`),
      );
      if (complete && task.status !== "published") {
        await db
          .update(schema.task)
          .set({ status: "published", publishedAt: new Date() })
          .where(eq(schema.task.id, task.id));
      }
    }

    return { ran: true, tasks: due.length, posted, failed };
  });

  return result ?? { ran: false, tasks: 0, posted: 0, failed: 0 };
}

/** How many tasks are waiting for their start time, for the admin overview. */
export async function countScheduledTasks() {
  const [row] = await db
    .select({ n: count() })
    .from(schema.task)
    .where(eq(schema.task.status, "scheduled"));
  return row.n;
}
