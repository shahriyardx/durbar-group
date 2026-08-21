import Link from "next/link";
import { redirect } from "next/navigation";

import { VerifyForm } from "@/app/verify/verify-form";
import type { Role } from "@/db/schema";
import { hasRole, homeFor, requireUser } from "@/lib/rbac";

const PROMISES = [
  {
    title: "নিজের ইন্সট্রাক্টর",
    body: "প্রতিটি ব্যাচের জন্য আলাদা ইন্সট্রাক্টর, আলাদা ক্যাটাগরি।",
  },
  {
    title: "নিয়মিত টাস্ক",
    body: "টাস্ক আর ডেডলাইন ড্যাশবোর্ডেই দেখতে পাবে — কোনটা কখন শেষ, সব এক জায়গায়।",
  },
  {
    title: "হেল্প ফোরাম",
    body: "প্রতিটি প্রশ্নের জন্য আলাদা পোস্ট — উত্তর হারিয়ে যায় না।",
  },
];

export default async function VerifyPage() {
  const user = await requireUser();
  if (user.studentVerified || hasRole(user.role, "instructor")) {
    redirect(homeFor(user.role as Role));
  }

  return (
    <main
      lang="bn"
      className="grid flex-1 lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.25fr_1fr]"
    >
      {/* Branding rail. Hidden on small screens, where the form is the only
          thing worth the space. */}
      <aside className="brand-glow grain relative isolate hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        {/* The grid lives on its own layer: `.blueprint` carries a mask-image,
            which would otherwise fade out this rail's text along with it. */}
        <div
          aria-hidden
          className="blueprint pointer-events-none absolute inset-0 -z-10"
        />

        <div>
          <Link
            href="/"
            className="text-brand-gradient font-heading text-2xl font-bold tracking-tight"
          >
            Durbar
          </Link>
          <p className="font-bangla text-muted-foreground mt-2 text-sm">
            দুর্বার গ্রুপ · প্রোগ্রামিং হিরো
          </p>
        </div>

        <div className="max-w-lg">
          <h1 className="font-bangla text-4xl leading-snug font-bold text-balance xl:text-5xl">
            আর <span className="text-brand-gradient">এক ধাপ</span> — তারপরই
            তোমার গ্রুপ
          </h1>
          <p className="font-bangla text-muted-foreground mt-6 leading-loose">
            দুর্বার গ্রুপ কোনো আলাদা কোর্স নয়। যারা নিয়ম মেনে লেগে থাকতে রাজি,
            এটা তাদের জন্য একটা ছোট, শক্ত টিম।
          </p>

          <ul className="mt-10 space-y-5">
            {PROMISES.map((item, index) => (
              <li key={item.title} className="flex gap-4">
                <span className="text-muted-foreground/70 mt-0.5 font-mono text-xs tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="font-bangla block font-semibold">
                    {item.title}
                  </span>
                  <span className="font-bangla text-muted-foreground block text-sm leading-loose">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-bangla text-muted-foreground/70 text-xs leading-loose">
          একবার ঢুকে পড়লে বাকিটা টিমের সঙ্গে — একা লেগে থাকতে হবে না।
        </p>
      </aside>

      <section className="border-border/60 flex items-center justify-center p-6 lg:border-l xl:p-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="text-brand-gradient font-heading mb-8 block text-xl font-bold tracking-tight lg:hidden"
          >
            Durbar
          </Link>

          <p className="font-bangla text-muted-foreground font-mono text-xs">
            ধাপ ২ / ২
          </p>
          <h2 className="font-bangla mt-3 text-3xl leading-snug font-bold">
            কোর্সের ইমেইল দিয়ে জয়েন করো
          </h2>
          <p className="font-bangla text-muted-foreground mt-4 text-sm leading-loose">
            <span className="text-foreground font-medium">{user.name}</span>{" "}
            হিসেবে লগইন করা আছে। তুমি যেই ইমেইল দিয়ে কোর্সে এনরোল করেছ, সেটা
            লিখলেই আমরা তোমাকে স্টুডেন্ট লিস্টে মিলিয়ে নেব।
          </p>

          <div className="mt-8">
            <VerifyForm />
          </div>
        </div>
      </section>
    </main>
  );
}
