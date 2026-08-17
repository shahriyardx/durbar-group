import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { requireTeachingSpace } from "@/lib/rbac";

// Signed-in screens have nothing to offer a search engine, and every one of
// them is behind a redirect anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  // Admins who also run a course reach these screens through their instructor
  // row, not through the role enum.
  const { user } = await requireTeachingSpace();
  return <AppShell user={user}>{children}</AppShell>;
}
