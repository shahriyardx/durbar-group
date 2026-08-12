import { AppShell } from "@/components/app-shell";
import { requireVerifiedStudent } from "@/lib/rbac";

export default async function StudentLayout({
  children,
}: LayoutProps<"/student">) {
  const user = await requireVerifiedStudent();
  return <AppShell user={user}>{children}</AppShell>;
}
