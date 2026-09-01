import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/eliminated/sign-out-button";
import { CriteriaList } from "@/components/criteria-list";
import { PillLink } from "@/components/landing/primitives";
import { formatDateBn } from "@/lib/format";
import { getSession } from "@/lib/rbac";
import { getElimination } from "@/server/elimination";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where an eliminated student lands, on this sign-in and every one after it.
 *
 * Deliberately outside `requireUser` — that guard is what redirects here, so
 * calling it would loop. It reads the session directly instead, and sends
 * anybody who is not actually eliminated back to their own dashboard.
 */
export default async function EliminatedPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const elimination = await getElimination(session.user.id);
  if (!elimination) redirect("/dashboard");

  return (
    <main
      lang="bn"
      className="grain relative isolate flex flex-1 justify-center overflow-hidden px-6 py-20"
    >
      <div className="brand-glow absolute inset-0 -z-10 opacity-60" />

      <div className="w-full max-w-2xl">
        <p className="text-muted-foreground font-mono text-[0.68rem] tracking-[0.32em] uppercase">
          <span className="text-destructive">Eliminated</span>
          <span className="ml-3">Durbar Group</span>
        </p>

        <h1 className="font-bangla mt-6 text-3xl font-extrabold text-balance sm:text-4xl">
          তোমাকে দূর্বার গ্রুপ থেকে ইলিমিনেট করা হয়েছে
        </h1>

        <p className="font-bangla text-muted-foreground mt-6 leading-loose">
          {elimination.name}, দূর্বার গ্রুপের ক্রাইটেরিয়া পূরণ না হওয়ায় তোমাকে
          গ্রুপ থেকে বাদ দেওয়া হয়েছে। ডিসকর্ড সার্ভার আর ড্যাশবোর্ড দুটোতেই
          তোমার অ্যাক্সেস বন্ধ করা হয়েছে
          {elimination.eliminatedAt
            ? ` — ${formatDateBn(elimination.eliminatedAt)} তারিখে।`
            : "।"}
        </p>

        <div className="border-destructive/40 bg-destructive/5 mt-8 rounded-2xl border p-6">
          <p className="font-bangla text-xs tracking-[0.18em]">
            ইলিমিনেশনের কারণ
          </p>
          <p className="font-bangla mt-3 leading-loose whitespace-pre-line">
            {elimination.reason ?? "অ্যাডমিন কোনো কারণ লিখে দেননি।"}
          </p>
        </div>

        <p className="font-bangla text-muted-foreground mt-8 text-sm leading-loose">
          কোনো ভুল হয়েছে মনে হলে তোমার ইন্সট্রাক্টর বা অ্যাডমিনের সঙ্গে যোগাযোগ
          করো। অ্যাডমিন সিদ্ধান্ত বদলালে এই অ্যাকাউন্ট দিয়েই আবার ঢুকতে পারবে।
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <SignOutButton />
          <PillLink href="/">হোমপেজ</PillLink>
        </div>

        <CriteriaList className="border-border/60 mt-16 border-t pt-12" />
      </div>
    </main>
  );
}
