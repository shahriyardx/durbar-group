import { AppShell } from "@/components/app-shell";
import { requireTeachingSpace } from "@/lib/rbac";

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  // Admins who also run a course reach these screens through their instructor
  // row, not through the role enum.
  const { user } = await requireTeachingSpace();
  return <AppShell user={user}>{children}</AppShell>;
}
