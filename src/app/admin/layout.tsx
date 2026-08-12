import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const user = await requireRole("admin");
  return <AppShell user={user}>{children}</AppShell>;
}
