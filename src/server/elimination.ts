import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { getDiscordUserId } from "@/lib/discord/account";
import { sendDirectMessage } from "@/lib/discord/messages";
import { removeGuildMember } from "@/lib/discord/provision";
import { escapeDiscordText } from "@/lib/markdown/discord";

export type EliminationResult = {
  name: string;
  /** True once they are out of the guild, not merely stripped of roles. */
  removedFromGuild: boolean;
  /** How many live sessions were destroyed. */
  sessionsKilled: number;
  /** Whether the student was told, in a DM, before being removed. */
  notified: boolean;
  dmError?: string;
  discordError?: string;
};

/**
 * What the student is sent in Discord. Their own reason is escaped: an admin
 * writing `*` or `#` should not have it rendered as markdown, and nothing in
 * a reason should ever be able to ping the server.
 */
function buildEliminationDm(name: string, reason: string) {
  return [
    `## দূর্বার গ্রুপ থেকে ইলিমিনেশন`,
    "",
    `${escapeDiscordText(name)}, দূর্বার গ্রুপের ক্রাইটেরিয়া পূরণ না হওয়ায় তোমাকে গ্রুপ থেকে বাদ দেওয়া হয়েছে। ডিসকর্ড সার্ভার থেকেও তোমাকে রিমুভ করা হচ্ছে।`,
    "",
    "**কারণ**",
    `> ${escapeDiscordText(reason).replace(/\n/g, "\n> ")}`,
    "",
    "-# কোনো ভুল হয়েছে মনে হলে তোমার ইন্সট্রাক্টর বা অ্যাডমিনের সঙ্গে যোগাযোগ করো।",
  ].join("\n");
}

/**
 * Put a student out of the Durbar Group.
 *
 * Four things happen, and none of them is a deletion: the flag goes on the
 * account (every guard reads it), their sessions are torn up so this takes
 * effect on the next click rather than in thirty days, they are told why in a
 * DM, and then they leave the Discord server. Their rows — imported student,
 * assignments, verification — all stay, because the admin screens are the
 * record of who was in the group and what happened to them.
 *
 * Discord runs after the commit. A failure there leaves stale access an admin
 * can clear by hand; failing the whole thing would leave a student the app
 * still considers a member.
 */
export async function eliminateStudent(
  userId: string,
  reason: string,
  adminId: string,
): Promise<EliminationResult | null> {
  const [account] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!account) return null;

  let sessionsKilled = 0;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({
        eliminated: true,
        eliminationReason: reason,
        eliminatedAt: new Date(),
        eliminatedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    const killed = await tx
      .delete(schema.session)
      .where(eq(schema.session.userId, userId))
      .returning({ id: schema.session.id });
    sessionsKilled = killed.length;
  });

  const discordUserId = await getDiscordUserId(userId);
  let removedFromGuild = false;
  let notified = false;
  let dmError: string | undefined;
  let discordError: string | undefined;

  if (discordUserId) {
    // The DM goes first, and the order is the whole point: a bot can only DM
    // somebody it shares a server with, so sending after the kick would fail
    // for exactly the person it is meant to reach. Best-effort either way —
    // a student with DMs closed still gets eliminated.
    const dm = await sendDirectMessage(
      discordUserId,
      buildEliminationDm(account.name, reason),
    );
    notified = dm.ok;
    if (!dm.ok) dmError = dm.error;

    try {
      await removeGuildMember(discordUserId, "Eliminated from the Durbar Group");
      removedFromGuild = true;
    } catch (error) {
      discordError =
        error instanceof Error ? error.message : "Discord call failed.";
      console.error(`[eliminate] Discord removal failed for user=${userId}:`, error);
    }
  }

  return {
    name: account.name,
    removedFromGuild,
    sessionsKilled,
    notified,
    dmError,
    discordError,
  };
}

/**
 * Undo an elimination. Deliberately does not put them back into Discord: the
 * rejoin button on their own dashboard does that, with their own OAuth token,
 * which is the only way in that does not depend on an invite.
 */
export async function restoreStudent(userId: string) {
  const [row] = await db
    .update(schema.user)
    .set({
      eliminated: false,
      eliminationReason: null,
      eliminatedAt: null,
      eliminatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, userId))
    .returning({ name: schema.user.name });
  return row ?? null;
}

export type Elimination = {
  name: string;
  reason: string | null;
  eliminatedAt: Date | null;
};

/** What the eliminated student is shown about their own elimination. */
export async function getElimination(
  userId: string,
): Promise<Elimination | null> {
  const [row] = await db
    .select({
      name: schema.user.name,
      eliminated: schema.user.eliminated,
      reason: schema.user.eliminationReason,
      eliminatedAt: schema.user.eliminatedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!row?.eliminated) return null;
  return { name: row.name, reason: row.reason, eliminatedAt: row.eliminatedAt };
}
