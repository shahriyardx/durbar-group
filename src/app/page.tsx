import { LandingBody } from "@/components/landing/landing-body";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { getCurrentUser } from "@/lib/rbac";

export default async function Home() {
  // Being signed in no longer bounces anyone away: the pitch is worth reading
  // twice, and every dashboard links back here through the logo. What changes
  // is the call to action — sign in becomes a way back to /dashboard.
  const signedIn = Boolean(await getCurrentUser());

  return (
    <div lang="bn" className="flex flex-1 flex-col">
      <LandingNav signedIn={signedIn} />
      <LandingHero signedIn={signedIn} />
      <LandingBody />
      <LandingFooter />
    </div>
  );
}
