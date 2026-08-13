import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
import { publishDueTasks } from "@/server/tasks";

/**
 * The scheduled trigger for task delivery. Point a cron at it:
 *
 *   * * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *       https://your-host/api/cron/publish-tasks
 *
 * Running it more often than needed costs nothing: publishing is idempotent
 * per (task, instructor) and guarded by an advisory lock, so overlapping runs
 * cannot double-post.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await publishDueTasks();
  if (result.posted > 0) {
    revalidatePath("/admin/tasks", "layout");
    revalidatePath("/student");
  }

  return Response.json(result);
}

export const POST = GET;
