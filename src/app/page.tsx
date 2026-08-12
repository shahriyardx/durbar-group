import { redirect } from "next/navigation";

import { LandingBody } from "@/components/landing/landing-body";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import type { Role } from "@/db/schema";
import { getCurrentUser, hasRole, homeFor } from "@/lib/rbac";

export default async function Home() {
  const user = await getCurrentUser();

  // Signed-in users never see the pitch — they go straight to their dashboard,
  // or to the course-email form if they have not verified yet.
  if (user) {
    if (!user.studentVerified && !hasRole(user.role, "instructor")) {
      redirect("/verify");
    }
    redirect(homeFor(user.role as Role));
  }

  return (
    <div lang="bn" className="flex flex-1 flex-col">
      <LandingNav />
      <LandingHero />
      <LandingBody />
      <LandingFooter />
    </div>
  );
}
