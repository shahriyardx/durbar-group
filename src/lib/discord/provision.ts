import "server-only";

import type { ChannelKey } from "@/db/schema";
import {
  ChannelType,
  INSTRUCTOR_ALLOW,
  OverwriteType,
  P,
  STUDENT_READ_ALLOW,
  STUDENT_READ_DENY,
  STUDENT_WRITE_ALLOW,
  bits,
} from "./permissions";
import {
  DiscordApiError,
  discordFetch,
  guildId,
  type DiscordChannel,
  type DiscordRole,
  type PermissionOverwrite,
} from "./rest";

/**
 * Channel layout every instructor category gets. Only discussion and help
 * let students post; the rest are announcement-style read-only.
 */
export const CHANNEL_LAYOUT: {
  key: ChannelKey;
  topic: string;
  studentsCanPost: boolean;
  /** Forum channels give every question its own thread. */
  forum?: boolean;
}[] = [
  { key: "announcements", topic: "Course announcements", studentsCanPost: false },
  { key: "task", topic: "Assignments and tasks", studentsCanPost: false },
  { key: "session", topic: "Class session notes and links", studentsCanPost: false },
  { key: "discussion", topic: "Open discussion", studentsCanPost: true },
  {
    key: "help",
    topic:
      "Ask your questions here. Open one post per question and tag it Solved once it is answered.",
    studentsCanPost: true,
    forum: true,
  },
  { key: "resources", topic: "Reading material and resources", studentsCanPost: false },
];

/** Tags Discord creates on the help forum so questions can be triaged. */
const HELP_FORUM_TAGS = [
  { name: "Unsolved", moderated: false },
  { name: "Solved", moderated: false },
];

export type InstructorSpace = {
  categoryId: string;
  instructorRoleId: string;
  studentRoleId: string;
  channels: { key: ChannelKey; channelId: string }[];
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "instructor"
  );
}

async function createRole(name: string, reason: string): Promise<DiscordRole> {
  return discordFetch<DiscordRole>(`/guilds/${guildId()}/roles`, {
    method: "POST",
    // No guild-wide permissions at all: access comes purely from the
    // per-category overwrites, which is what keeps instructors out of
    // each other's categories.
    body: { name, permissions: "0", mentionable: true, hoist: false },
    reason,
  });
}

/**
 * Create the instructor role, the matching student role, the category and all
 * six channels. Idempotency is the caller's job — it should only run once per
 * instructor row, and should persist the returned ids immediately.
 */
export async function provisionInstructorSpace(
  displayName: string,
  reason = "Instructor promoted in Durbar",
): Promise<InstructorSpace> {
  const slug = slugify(displayName);
  const instructorRole = await createRole(`instructor-${slug}`, reason);
  const studentRole = await createRole(`students-${slug}`, reason);

  const everyone = guildId(); // @everyone role id === guild id

  const categoryOverwrites: PermissionOverwrite[] = [
    {
      id: everyone,
      type: OverwriteType.ROLE,
      allow: "0",
      deny: bits(P.VIEW_CHANNEL),
    },
    {
      id: instructorRole.id,
      type: OverwriteType.ROLE,
      allow: INSTRUCTOR_ALLOW,
      deny: "0",
    },
    {
      id: studentRole.id,
      type: OverwriteType.ROLE,
      allow: STUDENT_READ_ALLOW,
      deny: STUDENT_READ_DENY,
    },
  ];

  const category = await discordFetch<DiscordChannel>(
    `/guilds/${guildId()}/channels`,
    {
      method: "POST",
      body: {
        name: displayName,
        type: ChannelType.GUILD_CATEGORY,
        permission_overwrites: categoryOverwrites,
      },
      reason,
    },
  );

  const channels: { key: ChannelKey; channelId: string }[] = [];
  for (const spec of CHANNEL_LAYOUT) {
    // Channels inherit the category by default; only the two writable ones
    // need their own overwrite set.
    const overwrites = spec.studentsCanPost
      ? [
          ...categoryOverwrites,
          {
            id: studentRole.id,
            type: OverwriteType.ROLE,
            allow: STUDENT_WRITE_ALLOW,
            deny: "0",
          },
        ]
      : undefined;

    const channel = await discordFetch<DiscordChannel>(
      `/guilds/${guildId()}/channels`,
      {
        method: "POST",
        body: {
          name: spec.key,
          // In a forum, SEND_MESSAGES is what lets a student open a post, and
          // SEND_MESSAGES_IN_THREADS lets them reply inside one — both are in
          // STUDENT_WRITE_ALLOW already.
          type: spec.forum ? ChannelType.GUILD_FORUM : ChannelType.GUILD_TEXT,
          topic: spec.topic,
          parent_id: category.id,
          ...(spec.forum ? { available_tags: HELP_FORUM_TAGS } : {}),
          ...(overwrites ? { permission_overwrites: overwrites } : {}),
        },
        reason,
      },
    );
    channels.push({ key: spec.key, channelId: channel.id });
  }

  return {
    categoryId: category.id,
    instructorRoleId: instructorRole.id,
    studentRoleId: studentRole.id,
    channels,
  };
}

/** Tear down a space when somebody stops being an instructor. */
export async function deprovisionInstructorSpace(space: {
  categoryId?: string | null;
  instructorRoleId?: string | null;
  studentRoleId?: string | null;
  channelIds?: string[];
}) {
  const reason = "Instructor role revoked in Durbar";
  for (const id of space.channelIds ?? []) {
    await ignoreMissing(discordFetch(`/channels/${id}`, { method: "DELETE", reason }));
  }
  if (space.categoryId) {
    await ignoreMissing(
      discordFetch(`/channels/${space.categoryId}`, { method: "DELETE", reason }),
    );
  }
  for (const roleId of [space.instructorRoleId, space.studentRoleId]) {
    if (!roleId) continue;
    await ignoreMissing(
      discordFetch(`/guilds/${guildId()}/roles/${roleId}`, {
        method: "DELETE",
        reason,
      }),
    );
  }
}

/**
 * Put a user in the guild. Needs the user's OAuth access token carrying the
 * guilds.join scope. Already-a-member returns 204 with no body, which we
 * treat as success.
 */
export async function addGuildMember(
  discordUserId: string,
  accessToken: string,
  roleIds: string[] = [],
) {
  await discordFetch(`/guilds/${guildId()}/members/${discordUserId}`, {
    method: "PUT",
    body: { access_token: accessToken, roles: roleIds },
    reason: "Verified student joined via Durbar",
  });
}

export async function addRoleToMember(
  discordUserId: string,
  roleId: string,
  reason = "Durbar assignment",
) {
  await discordFetch(
    `/guilds/${guildId()}/members/${discordUserId}/roles/${roleId}`,
    { method: "PUT", reason },
  );
}

export async function removeRoleFromMember(
  discordUserId: string,
  roleId: string,
  reason = "Durbar assignment removed",
) {
  await ignoreMissing(
    discordFetch(
      `/guilds/${guildId()}/members/${discordUserId}/roles/${roleId}`,
      { method: "DELETE", reason },
    ),
  );
}

/**
 * Kick somebody out of the guild entirely. Needs KICK_MEMBERS on the bot, and
 * the bot's own role above theirs. Somebody who already left is the outcome we
 * wanted, so 404 is success.
 */
export async function removeGuildMember(
  discordUserId: string,
  reason = "Verification revoked in Durbar",
) {
  await ignoreMissing(
    discordFetch(`/guilds/${guildId()}/members/${discordUserId}`, {
      method: "DELETE",
      reason,
    }),
  );
}

export async function isGuildMember(discordUserId: string) {
  try {
    await discordFetch(`/guilds/${guildId()}/members/${discordUserId}`);
    return true;
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) return false;
    throw error;
  }
}

/** Deleting something Discord already lost is not an error for us. */
async function ignoreMissing<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) return undefined;
    throw error;
  }
}
