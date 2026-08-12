import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Roster spreadsheets travel through a server action; the 1 MB default
      // rejects anything past a few hundred students.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
