# syntax=docker/dockerfile:1

# `output: "standalone"` in next.config.ts traces only the files the server
# actually needs, so the final image is around 200 MB rather than carrying the
# whole node_modules tree.
#
# Three stages, and each uses the runtime that behaves best for its job:
#   deps    — Bun, because bun.lock is what pins the versions
#   builder — Node, because Bun 1.3.14 segfaults on exit from `next build`
#             (the output is fine, but the non-zero status fails the layer)
#   runner  — Bun, which runs both server.js and the TypeScript migrator

FROM oven/bun:1.3.14-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile


FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# src/lib/env.ts validates the environment the moment it is imported, and
# `next build` imports it while collecting routes — so the build needs values,
# any values. They are set on this one command rather than with ENV so they
# never become part of the image: nothing here is NEXT_PUBLIC_, so nothing is
# inlined into a bundle, and every one is read from the real environment at
# runtime instead.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-secret" \
    BETTER_AUTH_URL="http://localhost:3000" \
    DISCORD_CLIENT_ID="build" \
    DISCORD_CLIENT_SECRET="build" \
    DISCORD_BOT_TOKEN="build" \
    DISCORD_GUILD_ID="build" \
    node node_modules/next/dist/bin/next build


FROM oven/bun:1.3.14-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system durbar && useradd --system --gid durbar durbar

# The standalone bundle brings its own trimmed node_modules, plus the drizzle/
# folder and the Postgres driver that outputFileTracingIncludes pins for the
# migration step. Static assets and public/ are not traced and come separately.
COPY --from=builder --chown=durbar:durbar /app/.next/standalone ./
COPY --from=builder --chown=durbar:durbar /app/.next/static ./.next/static
COPY --from=builder --chown=durbar:durbar /app/public ./public
COPY --from=builder --chown=durbar:durbar /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --chown=durbar:durbar docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER durbar
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
