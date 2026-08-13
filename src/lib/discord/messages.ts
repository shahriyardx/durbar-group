import "server-only";

import { discordFetch } from "./rest";

export type DiscordMessage = { id: string; channel_id: string };

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
    body: {
      content,
      allowed_mentions: {
        parse: [],
        roles: mentionRoleIds,
        users: [],
      },
    },
  });
}
