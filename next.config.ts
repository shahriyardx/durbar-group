import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Traces only the files the server actually needs, so the Docker image
  // carries a few hundred MB instead of the whole node_modules tree.
  output: "standalone",
  // The migration runner is not reachable from any route, so tracing misses
  // both the SQL files and drizzle-orm's migrator. The whole package is
  // pinned rather than the migrator alone because it reaches back into the
  // package root, which tracing cannot see through.
  outputFileTracingIncludes: {
    "/": ["./drizzle/**/*", "./node_modules/drizzle-orm/**/*"],
  },
  experimental: {
    serverActions: {
      // Roster spreadsheets travel through a server action; the 1 MB default
      // rejects anything past a few hundred students.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
