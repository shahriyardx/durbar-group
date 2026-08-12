import { DiscordSignIn } from "@/components/discord-sign-in";
import { CTA_CLASS, PillLink } from "@/components/landing/primitives";

const SPECS = [
  { value: "60/60", label: "Assignment 2 ও Assignment 3 — দুটোতেই" },
  { value: "০১", label: "Logic & IQ Test, ২৪ জুলাই এনাউন্সমেন্ট" },
  { value: "০০", label: "Life / Gems দিয়ে পাওয়া মার্কস গ্রহণযোগ্য নয়" },
  { value: "১০০%", label: "ঐচ্ছিক — বাধ্যতামূলক কোনো প্রোগ্রাম নয়" },
];

const MARQUEE = [
  "Problem Solving",
  "Communication Skills",
  "Professional Branding",
  "Real-World Project Experience",
  "Early Job Placement",
  "English Masterclass",
];

export function LandingHero() {
  return (
    <section className="grain relative isolate overflow-hidden">
      <div className="brand-glow absolute inset-0 -z-20" />
      <div className="blueprint absolute inset-0 -z-10" />

      {/* Decorative wordmark behind the headline — out of the a11y tree. */}
      <span
        aria-hidden
        className="font-bangla text-foreground/[0.05] pointer-events-none absolute top-16 right-8 -z-10 hidden text-[9rem] leading-none font-bold select-none lg:block xl:text-[11rem]"
      >
        দুর্বার
      </span>

      <div className="mx-auto w-full max-w-6xl px-6 pt-20 pb-6 sm:pt-28 sm:pb-10">
        <p
          className="reveal text-muted-foreground font-mono text-[0.68rem] tracking-[0.34em] uppercase"
          style={{ "--d": "0ms" } as React.CSSProperties}
        >
          Programming Hero · Growth Opportunity
        </p>

        <h1
          className="reveal font-bangla mt-7 max-w-4xl text-5xl leading-[1.1] font-bold sm:text-7xl lg:text-8xl"
          style={{ "--d": "90ms" } as React.CSSProperties}
        >
          <span className="text-brand-gradient">দুর্বার</span> গ্রুপ
        </h1>

        <p
          className="reveal font-bangla mt-6 max-w-2xl text-xl leading-relaxed sm:text-2xl"
          style={{ "--d": "150ms" } as React.CSSProperties}
        >
          নিজের সীমা ছাড়িয়ে আরও একধাপ এগিয়ে যাওয়ার সুযোগ।
        </p>

        <p
          className="reveal font-bangla text-muted-foreground mt-6 max-w-2xl leading-loose"
          style={{ "--d": "210ms" } as React.CSSProperties}
        >
          তুমি যদি বুটক্যাম্পের মডিউল কমপ্লিট করেই থেমে যেতে না চাও, কিছুটা বেশি
          সময় দিয়ে হার্ডওয়ার্ক করে নিজেকে দেশী-বিদেশী টপ কম্পানির জন্য একজন
          AI-Powered Web Engineer হিসেবে গড়ে তুলতে চাও — তাহলে দুর্বার গ্রুপ
          তোমার জন্য।
        </p>

        <div
          className="reveal mt-10 flex flex-wrap items-center gap-4"
          style={{ "--d": "270ms" } as React.CSSProperties}
        >
          <DiscordSignIn
            label="জয়েন করো"
            className={`${CTA_CLASS} font-bangla`}
          />
          <PillLink
            href="#criteria"
            className="font-bangla text-sm tracking-normal normal-case"
          >
            সিলেকশন প্রসেস
          </PillLink>
        </div>

        <dl
          className="reveal border-border/60 divide-border/60 mt-16 grid border-t lg:grid-cols-4 lg:divide-x"
          style={{ "--d": "360ms" } as React.CSSProperties}
        >
          {SPECS.map((spec) => (
            // min-w-0 stops a long label from widening its own column: grid
            // items default to min-width:auto, which made the rules uneven.
            <div
              key={spec.value}
              className="min-w-0 py-7 lg:px-8 lg:first:pl-0 lg:last:pr-0"
            >
              <dt className="font-bangla text-4xl leading-none font-bold">
                {spec.value}
              </dt>
              <dd className="font-bangla text-muted-foreground mt-3 text-sm leading-relaxed">
                {spec.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-border/60 overflow-hidden border-y py-4">
        <div className="marquee-track flex w-max gap-10">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center gap-10">
              {MARQUEE.map((item) => (
                <li
                  key={item}
                  className="text-muted-foreground flex items-center gap-10 font-mono text-[0.7rem] tracking-[0.28em] whitespace-nowrap uppercase"
                >
                  {item}
                  <span className="bg-brand-gradient inline-block size-1.5 rounded-full" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
