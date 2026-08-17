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
