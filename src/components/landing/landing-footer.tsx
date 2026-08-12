import { DiscordSignIn } from "@/components/discord-sign-in";
import { CTA_CLASS } from "@/components/landing/primitives";

const STEPS = [
  "কোর্সে যে Discord অ্যাকাউন্ট ব্যবহার করো, সেটি দিয়ে লগইন করো",
  "কোর্সে রেজিস্টার করা ইমেইলটি সাবমিট করো",
  "ইন্সট্রাক্টরের সঙ্গে অ্যাসাইন হলেই ডিসকর্ড চ্যানেলগুলো খুলে যাবে",
];

export function LandingFooter() {
  return (
    <footer className="grain border-border/60 relative isolate overflow-hidden border-t">
      <div className="brand-glow absolute inset-0 -z-10 opacity-70" />

      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <h2 className="font-bangla text-4xl leading-snug font-bold text-balance sm:text-5xl">
              নিজের সীমা ছাড়িয়ে যেতে
              <span className="text-brand-gradient"> প্রস্তুত?</span>
            </h2>
            <p className="font-bangla text-muted-foreground mt-6 max-w-md leading-loose">
              সফলতার পথ সবার জন্য এক নয়। দুর্বার গ্রুপ তাদের জন্য, যারা নিজেদের
              সীমা ছাড়িয়ে আরও একধাপ এগিয়ে যেতে চায়।
            </p>
            <div className="mt-9">
              <DiscordSignIn
                label="জয়েন করো"
                className={`${CTA_CLASS} font-bangla`}
              />
            </div>
            <p className="font-bangla text-muted-foreground mt-4 text-xs">
              লগইন শুধু Discord দিয়ে — কোনো পাসওয়ার্ড মনে রাখতে হবে না।
            </p>
          </div>

          <ol className="border-border/60 grid content-start gap-px border-t">
            {STEPS.map((step, i) => (
              <li
                key={step}
                className="border-border/60 flex gap-5 border-b py-5"
              >
                <span className="font-mono text-[0.68rem] tracking-[0.28em]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-bangla text-muted-foreground text-sm leading-loose">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-border/60 text-muted-foreground mt-20 flex flex-wrap items-center justify-between gap-4 border-t pt-8 font-mono text-[0.65rem] tracking-[0.24em] uppercase">
          <span>Durbar Group · Programming Hero</span>
          <span className="font-bangla tracking-normal normal-case">
            একটি অতিরিক্ত Growth Opportunity
          </span>
        </div>
      </div>
    </footer>
  );
}
