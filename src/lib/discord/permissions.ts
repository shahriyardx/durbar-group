/**
 * Discord permission bits we actually use. Values are bit flags, so they are
 * BigInt and get serialised as decimal strings on the wire.
 * https://discord.com/developers/docs/topics/permissions
 */
export const P = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  MANAGE_CHANNELS: 1n << 4n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  MOVE_MEMBERS: 1n << 24n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
} as const;

export function bits(...flags: bigint[]): string {
  return flags.reduce((acc, f) => acc | f, 0n).toString();
}

export const OverwriteType = { ROLE: 0, MEMBER: 1 } as const;

export const ChannelType = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_FORUM: 15,
} as const;

/** Everything an instructor may do inside their own category. */
export const INSTRUCTOR_ALLOW = bits(
  P.VIEW_CHANNEL,
  P.SEND_MESSAGES,
  P.MANAGE_MESSAGES,
  P.MANAGE_CHANNELS,
  P.MANAGE_THREADS,
  P.CREATE_PUBLIC_THREADS,
  P.SEND_MESSAGES_IN_THREADS,
  P.EMBED_LINKS,
  P.ATTACH_FILES,
  P.ADD_REACTIONS,
  P.READ_MESSAGE_HISTORY,
  P.MENTION_EVERYONE,
  P.CONNECT,
  P.SPEAK,
  P.MUTE_MEMBERS,
  P.MOVE_MEMBERS,
);

/** Read-only baseline applied at the category level for students. */
export const STUDENT_READ_ALLOW = bits(
  P.VIEW_CHANNEL,
  P.READ_MESSAGE_HISTORY,
  P.CONNECT,
);

export const STUDENT_READ_DENY = bits(
  P.SEND_MESSAGES,
  P.SEND_MESSAGES_IN_THREADS,
  P.CREATE_PUBLIC_THREADS,
  P.ADD_REACTIONS,
);

/** Channel-level override that re-opens posting in discussion/help. */
export const STUDENT_WRITE_ALLOW = bits(
  P.VIEW_CHANNEL,
  P.SEND_MESSAGES,
  P.SEND_MESSAGES_IN_THREADS,
  P.CREATE_PUBLIC_THREADS,
  P.ADD_REACTIONS,
  P.EMBED_LINKS,
  P.ATTACH_FILES,
  P.READ_MESSAGE_HISTORY,
);
