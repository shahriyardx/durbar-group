import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/rbac";

// Signed-in screens have nothing to offer a search engine, and every one of
// them is behind a redirect anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const user = await requireRole("admin");
  return <AppShell user={user}>{children}</AppShell>;
}
