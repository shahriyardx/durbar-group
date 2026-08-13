import { Receiver } from "@upstash/qstash";
import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
import { publishDueTasks } from "@/server/tasks";

/**
 * The scheduled trigger for task delivery, called hourly by an Upstash QStash
 * schedule. QStash signs every delivery, so the signature is the primary
 * authentication; a plain `Bearer $CRON_SECRET` is also accepted so the route
 * can be driven by curl or any other scheduler.
 *
 * Running it more often than needed costs nothing: publishing is idempotent
 * per (task, instructor) and guarded by an advisory lock, so overlapping runs
 * cannot double-post.
 */

const receiver =
  env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
      })
    : null;

async function authorise(request: Request) {
  const signature = request.headers.get("upstash-signature");

  if (signature) {
    if (!receiver) return "qstash-not-configured" as const;
    try {
      // The signature covers the destination URL, which is the one configured
      // on the QStash schedule — the same public origin as BETTER_AUTH_URL.
      const valid = await receiver.verify({
        signature,
        body: await request.text(),
        url: new URL("/api/cron/publish-tasks", env.BETTER_AUTH_URL).toString(),
      });
      return valid ? ("ok" as const) : ("bad-signature" as const);
    } catch {
      return "bad-signature" as const;
    }
  }

  if (!env.CRON_SECRET) return "no-auth-configured" as const;
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`
    ? ("ok" as const)
    : ("bad-secret" as const);
}

async function handler(request: Request) {
  const outcome = await authorise(request);

  if (outcome === "qstash-not-configured" || outcome === "no-auth-configured") {
    return Response.json(
      {
        error:
          "Set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY, or CRON_SECRET.",
      },
      { status: 503 },
    );
  }
  if (outcome !== "ok") {
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
