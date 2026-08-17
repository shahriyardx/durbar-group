import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { requireVerifiedStudent } from "@/lib/rbac";

// Signed-in screens have nothing to offer a search engine, and every one of
// them is behind a redirect anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({
  children,
}: LayoutProps<"/student">) {
  const user = await requireVerifiedStudent();
  return <AppShell user={user}>{children}</AppShell>;
}
