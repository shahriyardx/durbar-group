import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
import { publishDueTasks } from "@/server/tasks";

/**
 * The scheduled trigger for task delivery, called hourly by an Upstash QStash
 * schedule pointed at `/api/cron?key=$CRON_SECRET`.
 *
 * Running it more often than needed costs nothing: publishing is idempotent
 * per (task, instructor) and guarded by an advisory lock, so overlapping runs
 * cannot double-post.
 */

function keyMatches(candidate: string, secret: string) {
  // Compare in constant time; timingSafeEqual throws on a length mismatch, so
  // the lengths are checked first.
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handler(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!keyMatches(key, env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await publishDueTasks();
  if (result.posted > 0) {
    revalidatePath("/admin/tasks", "layout");
    revalidatePath("/student");
  }

  return Response.json(result);
}

// QStash schedules deliver with POST; GET is there for a manual curl.
export const GET = handler;
export const POST = handler;
