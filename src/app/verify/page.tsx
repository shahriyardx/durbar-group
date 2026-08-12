import { redirect } from "next/navigation";

import { VerifyForm } from "@/app/verify/verify-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/db/schema";
import { hasRole, homeFor, requireUser } from "@/lib/rbac";

export default async function VerifyPage() {
  const user = await requireUser();
  if (user.studentVerified || hasRole(user.role, "instructor")) {
    redirect(homeFor(user.role as Role));
  }

  return (
    <main
      lang="bn"
      className="brand-glow grain relative isolate flex flex-1 items-center justify-center overflow-hidden p-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="font-bangla text-muted-foreground text-xs">
            ধাপ ২ / ২
          </p>
          <CardTitle className="font-bangla pt-2 text-2xl leading-snug">
            কোর্সের ইমেইল দিয়ে জয়েন করো
          </CardTitle>
          <CardDescription className="font-bangla leading-loose">
            {user.name} হিসেবে লগইন করা আছে। তুমি যেই ইমেইল দিয়ে কোর্সে এনরোল
            করেছ, সেটা লিখলেই আমরা তোমাকে স্টুডেন্ট লিস্টে মিলিয়ে নেব।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyForm />
        </CardContent>
      </Card>
    </main>
  );
}
