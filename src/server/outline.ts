import "server-only";

import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";

export const outlineInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give the outline entry a title.").max(180),
    releasedAt: z.date(),
    // Optional: a session or a module opening has no deadline.
    dueAt: z.date().nullable(),
  })
  .refine((value) => !value.dueAt || value.dueAt >= value.releasedAt, {
    path: ["dueAt"],
    message: "The deadline has to be on or after the release date.",
  });

export type OutlineInput = z.infer<typeof outlineInputSchema>;

/**
 * Where an outline row sits relative to now. Derived here rather than in a
 * component: `Date.now()` during render is the impurity React's compiler
 * rejects, and both dashboards need the same answer.
 */
export type OutlineState = "upcoming" | "open" | "closed";

export function outlineState(
  item: { releasedAt: Date; dueAt: Date | null },
  now: Date = new Date(),
): OutlineState {
  if (item.releasedAt > now) return "upcoming";
  if (item.dueAt && item.dueAt < now) return "closed";
  return "open";
}

export type OutlineRow = typeof schema.outlineItem.$inferSelect & {
  state: OutlineState;
};

function withState(
  rows: (typeof schema.outlineItem.$inferSelect)[],
): OutlineRow[] {
  const now = new Date();
  return rows.map((row) => ({ ...row, state: outlineState(row, now) }));
}

/** The whole outline, in the order it happens. */
export async function listOutline(): Promise<OutlineRow[]> {
  const rows = await db
    .select()
    .from(schema.outlineItem)
    .orderBy(asc(schema.outlineItem.releasedAt), asc(schema.outlineItem.createdAt));
  return withState(rows);
}

export async function getOutlineItem(id: string) {
  const [row] = await db
    .select()
    .from(schema.outlineItem)
    .where(eq(schema.outlineItem.id, id))
    .limit(1);
  return row ?? null;
}

export async function createOutlineItem(input: OutlineInput, adminId: string) {
  const [row] = await db
    .insert(schema.outlineItem)
    .values({
      title: input.title,
      releasedAt: input.releasedAt,
      dueAt: input.dueAt,
      createdBy: adminId,
    })
    .returning();
  return row;
}

export async function updateOutlineItem(id: string, input: OutlineInput) {
  const [row] = await db
    .update(schema.outlineItem)
    .set({
      title: input.title,
      releasedAt: input.releasedAt,
      dueAt: input.dueAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.outlineItem.id, id))
    .returning();
  return row ?? null;
}

export async function deleteOutlineItem(id: string) {
  await db.delete(schema.outlineItem).where(eq(schema.outlineItem.id, id));
}

export async function countOutlineItems() {
  const [row] = await db.select({ n: count() }).from(schema.outlineItem);
  return row.n;
}
