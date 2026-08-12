import "server-only";

import { env } from "@/lib/env";

const API = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`Discord ${status} on ${path}: ${JSON.stringify(body)}`);
    this.name = "DiscordApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Shows up in the guild audit log. */
  reason?: string;
  /** Bearer token of a user, for the few endpoints that need one. */
  bearer?: string;
};

/**
 * Thin Discord REST client. Retries 429s using the retry_after Discord hands
 * back, and 5xx with a short linear backoff. Everything else throws.
 */
export async function discordFetch<T = unknown>(
  path: string,
  { method = "GET", body, reason, bearer }: RequestOptions = {},
  attempt = 0,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: bearer ? `Bearer ${bearer}` : `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
  if (reason) headers["X-Audit-Log-Reason"] = reason.slice(0, 512);

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 5) {
    const payload = (await res.json().catch(() => ({}))) as {
      retry_after?: number;
    };
    const waitMs = Math.ceil((payload.retry_after ?? 1) * 1000) + 100;
    await new Promise((r) => setTimeout(r, waitMs));
    return discordFetch<T>(path, { method, body, reason, bearer }, attempt + 1);
  }

  if (res.status >= 500 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return discordFetch<T>(path, { method, body, reason, bearer }, attempt + 1);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => res.statusText);
    throw new DiscordApiError(res.status, path, errBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const guildId = () => env.DISCORD_GUILD_ID;

export type DiscordRole = { id: string; name: string; position: number };
export type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
};
export type PermissionOverwrite = {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
};
