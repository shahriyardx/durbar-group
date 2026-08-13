import "server-only";

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  // Optional: without it the cron route refuses to run and task publishing
  // falls back to being nudged along by admin page views.
  // An empty value counts as "not set", so a blank line copied from
  // .env.example does not fail startup.
  CRON_SECRET: z.union([z.string().min(16), z.literal("")]).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("\n  ");
  throw new Error(`Invalid environment variables:\n  ${missing}`);
}

export const env = parsed.data;
