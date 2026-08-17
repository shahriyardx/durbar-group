#!/bin/sh
set -e

# Migrations run here rather than in the Dockerfile on purpose. A build should
# produce the same image wherever it runs, and Coolify may well build on a host
# that cannot reach the database at all; a container start always can. The
# migrator records what it has applied, so a restart with nothing new to do
# costs one query.
echo "durbar: applying migrations…"
bun run /app/scripts/migrate.ts

echo "durbar: starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec bun run /app/server.js
