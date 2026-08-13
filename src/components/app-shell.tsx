import Link from "next/link";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { getTeachingSpace, hasRole } from "@/lib/rbac";

// Students see a Bengali interface; staff screens stay in English.
const ROLE_LABEL: Record<Role, string> = {
  student: "শিক্ষার্থী",
  instructor: "Instructor",
  admin: "Admin",
  super_admin: "Super admin",
};

function navFor(role: Role, teaching: boolean) {
  const nav: { href: string; label: string }[] = [];
  if (hasRole(role, "admin")) {
    nav.push(
      { href: "/admin", label: "Overview" },
      { href: "/admin/students", label: "Students" },
      { href: "/admin/instructors", label: "Instructors" },
      { href: "/admin/tasks", label: "Tasks" },
      { href: "/admin/users", label: "Users" },
    );
    // An admin who also runs a course gets a way into their own space.
    if (teaching) nav.push({ href: "/instructor", label: "My course" });
  } else if (teaching || role === "instructor") {
    nav.push(
      { href: "/instructor", label: "Overview" },
      { href: "/instructor/students", label: "My students" },
    );
  }
  // Students get no navigation: /student is the only page they have.
  return nav;
}

export async function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const role = user.role as Role;
  const teaching = Boolean(await getTeachingSpace(user.id));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link
            href="/"
            className="text-brand-gradient font-heading text-lg font-bold tracking-tight"
          >
            Durbar
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {navFor(role, teaching).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Badge
              variant="secondary"
              className={role === "student" ? "font-bangla" : undefined}
            >
              {ROLE_LABEL[role]}
            </Badge>
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              signOutLabel={role === "student" ? "সাইন আউট" : "Sign out"}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
