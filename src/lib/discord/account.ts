import "server-only";

import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { DiscordApiError, discordFetch } from "@/lib/discord/rest";

/** The Discord snowflake for a Durbar user, or null if never linked. */
export async function getDiscordUserId(userId: string) {
  const [row] = await db
    .select({ accountId: schema.account.accountId })
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "discord"),
      ),
    )
    .limit(1);
  return row?.accountId ?? null;
}

/**
 * A usable Discord user access token. better-auth refreshes it with the stored
 * refresh token when it has expired; if that fails we fall back to the stored
 * token, which is still fine when it simply has not expired yet.
 */
export async function getDiscordAccessToken(userId: string) {
  try {
    const result = await auth.api.getAccessToken({
      body: { providerId: "discord", userId },
    });
    if (result?.accessToken) return result.accessToken;
  } catch {
    // fall through to the stored token
  }

  const [row] = await db
    .select({
      accessToken: schema.account.accessToken,
      expiresAt: schema.account.accessTokenExpiresAt,
    })
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "discord"),
      ),
    )
    .limit(1);

  if (!row?.accessToken) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return row.accessToken;
}

export type TokenInfo =
  | { ok: true; scopes: string[]; userId: string | null; expires: string | null }
  | { ok: false };

/**
 * Ask Discord what an access token actually is before spending it.
 *
 * `PUT /guilds/{g}/members/{u}` reports a token it cannot resolve as
 * "10013 Unknown User", which reads as though the student does not exist —
 * so the useful question is asked first, and the answer names the real
 * problem: dead token, missing consent, or a token for somebody else.
 */
export async function inspectAccessToken(
  accessToken: string,
): Promise<TokenInfo> {
  try {
    const info = await discordFetch<{
      scopes?: string[];
      expires?: string;
      user?: { id?: string };
    }>("/oauth2/@me", { bearer: accessToken });

    return {
      ok: true,
      scopes: info.scopes ?? [],
      userId: info.user?.id ?? null,
      expires: info.expires ?? null,
    };
  } catch (error) {
    // 401 is exactly "this token is no longer good".
    if (error instanceof DiscordApiError && error.status === 401) {
      return { ok: false };
    }
    throw error;
  }
}
