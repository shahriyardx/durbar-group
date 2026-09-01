import "server-only";

import { DiscordApiError, discordFetch } from "./rest";

export type DiscordMessage = { id: string; channel_id: string };

function mentions(roleIds: string[]) {
  return { parse: [], roles: roleIds, users: [] };
}

/**
 * Post into a text channel. `allowed_mentions` is explicit on purpose: the
 * default would let anything that looks like a mention in the body ping, so
 * we whitelist exactly the roles we mean to ping and nothing else.
 */
export async function createMessage(
  channelId: string,
  content: string,
  mentionRoleIds: string[] = [],
) {
  return discordFetch<DiscordMessage>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: { content, allowed_mentions: mentions(mentionRoleIds) },
  });
}

/**
 * Rewrite a message we posted. Discord does not re-notify on an edit, so an
 * edited task will not ping anybody a second time.
 */
export async function editMessage(
  channelId: string,
  messageId: string,
  content: string,
  mentionRoleIds: string[] = [],
) {
  return discordFetch<DiscordMessage>(
    `/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      body: { content, allowed_mentions: mentions(mentionRoleIds) },
    },
  );
}

/**
 * Remove a message we posted. A message somebody already deleted by hand in
 * Discord is the outcome we wanted, so 404 counts as success.
 */
export async function deleteMessage(
  channelId: string,
  messageId: string,
  reason = "Task removed in Durbar",
) {
  try {
    await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      reason,
    });
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) return;
    throw error;
  }
}

/**
 * Send a direct message to one user.
 *
 * Two calls: open (or reuse) the DM channel, then post into it. Discord gives
 * back the same channel every time, so this is safe to call repeatedly.
 *
 * It fails for reasons that are the recipient's choice, not our bug — DMs
 * from server members turned off, the bot blocked, no shared server any more
 * — so it reports rather than throws. Anything that depends on the DM landing
 * has to treat it as best-effort.
 */
export async function sendDirectMessage(
  discordUserId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const channel = await discordFetch<{ id: string }>("/users/@me/channels", {
      method: "POST",
      body: { recipient_id: discordUserId },
    });

    await discordFetch(`/channels/${channel.id}/messages`, {
      method: "POST",
      // Nothing in this message should ever ping anybody.
      body: { content, allowed_mentions: { parse: [] } },
    });

    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof DiscordApiError
        ? `Discord ${error.status} on ${error.path} — ${JSON.stringify(error.body)}`
        : error instanceof Error
          ? error.message
          : "Unknown error";
    console.error(`[dm] could not reach ${discordUserId}: ${reason}`);
    return { ok: false, error: reason };
  }
}
