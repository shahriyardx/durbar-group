import "server-only";

import { z } from "zod";

/** Present-but-blank in .env means "not configured", not "invalid". */
const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  // The key the hourly Upstash schedule puts on /api/cron?key=… . Without it
  // that route refuses to run and task publishing falls back to being nudged
  // along by admin page views.
  CRON_SECRET: optional.refine((value) => !value || value.length >= 24, {
    message: "must be at least 24 characters — it travels in a URL",
  }),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("\n  ");
  throw new Error(`Invalid environment variables:\n  ${missing}`);
}

export const env = parsed.data;
