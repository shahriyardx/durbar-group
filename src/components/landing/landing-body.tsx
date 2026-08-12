import { Section, SectionLabel } from "@/components/landing/primitives";

const FOCUS = [
  {
    title: "Problem Solving",
    body: "নিয়মিত প্র্যাকটিসের মাধ্যমে লজিক ও অ্যালগরিদমের গভীরতা বাড়ানো — যা টপ কম্পানির ইন্টারভিউতে সবচেয়ে বেশি কাজে লাগে।",
  },
  {
    title: "Communication Skills",
    body: "ইন্টারভিউ, টিম ডিসকাশন আর ক্লায়েন্ট কমিউনিকেশনে নিজের কথা পরিষ্কারভাবে বলার দক্ষতা।",
  },
  {
    title: "Professional Branding",
    body: "প্রোফাইল, পোর্টফোলিও আর অনলাইন প্রেজেন্স — যা রিক্রুটারের চোখে আলাদা করে তোলে।",
  },
  {
    title: "Real-World Project Experience",
    body: "টিউটোরিয়াল ক্লোন নয় — বাস্তব, প্রোডাকশন-রেডি অ্যাপ্লিকেশন নিজের হাতে বানানোর অভিজ্ঞতা।",
  },
];

const BENEFITS = [
  {
    n: "০১",
    title: "Top Company Placement Preparation",
    body: "দেশী-বিদেশী টপ কম্পানির ইন্টারভিউ প্রসেস ধরে ধরে প্রস্তুতি।",
  },
  {
    n: "০২",
    title: "Problem Solving Skills Upgradation",
    body: "ফোকাসড প্র্যাকটিস সেশন, যেখানে প্রতিটি ধাপে লেভেল বাড়ে।",
  },
  {
    n: "০৩",
    title: "Early Job Placement Facilities",
    body: "হায়ারিং চ্যানেলে সরাসরি অ্যাক্সেস আর আগেভাগে জব সুযোগ।",
  },
  {
    n: "০৪",
    title: "English Masterclass",
    body: "রিমোট ও লোকাল — দুই ধরনের রোলের জন্যই ইংরেজি কমিউনিকেশন ট্রেনিং।",
  },
  {
    n: "০৫",
    title: "Real-World Project Experience",
    body: "শুরু থেকে শেষ পর্যন্ত পূর্ণাঙ্গ প্রোডাকশন-গ্রেড প্রজেক্ট।",
  },
  {
    n: "০৬",
    title: "Strong Peer Learning Environment",
    body: "যারা তোমার মতোই পরিশ্রম করছে, তাদের সঙ্গেই শেখার পরিবেশ।",
  },
];

const DISQUALIFIERS = [
  "Main Deadline-এর পরে সাবমিট করা এসাইনমেন্ট",
  "গ্রেস পিরিয়ডে পাওয়া মার্কস",
  "Life / Gems ব্যবহার করে পাওয়া মার্কস",
];

const NOTES = [
  {
    title: "বাধ্যতামূলক নয়",
    body: "দুর্বার গ্রুপ সবার জন্য বাধ্যতামূলক কোনো প্রোগ্রাম নয়। এটি তাদের জন্য, যারা Bootcamp-এর নিয়মিত কার্যক্রমের পাশাপাশি অতিরিক্ত সময় ও পরিশ্রম করে নিজেদের আরও এগিয়ে নিতে চায়।",
  },
  {
    title: "কেউ পিছিয়ে পড়বে না",
    body: "দুর্বার গ্রুপে না থাকলেও Bootcamp-এর সকল Learning Materials, Mentorship এবং Job Placement Support ধাপে ধাপে সবার জন্যই আসবে।",
  },
  {
    title: "সফলতার একমাত্র পথ নয়",
    body: "দুর্বার গ্রুপে না থাকলে সফল হওয়া যাবে না বা ভালো জব পাওয়া যাবে না — বিষয়টি এমন নয়। নিয়মিতভাবে Bootcamp-এর কার্যক্রম সম্পন্ন করলে তোমার জন্যও ধাপে ধাপে সব সাপোর্ট থাকবে।",
  },
];

export function LandingBody() {
  return (
    <>
      <Section id="mission">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="০১">মিশন</SectionLabel>
            <h2 className="font-bangla mt-6 text-3xl leading-snug font-bold sm:text-4xl">
              দুর্বার গ্রুপ আসলে কী?
            </h2>
          </div>

          <div className="on-scroll space-y-6 lg:col-span-8">
            <p className="font-bangla text-xl leading-loose">
              এটি এমন একটি বিশেষ গ্রুপ, যেখানে নির্বাচিত শিক্ষার্থীরা নিয়মিত
              Problem Solving, Communication Skills, Professional Branding এবং
              Real-World Project Experience-এর মাধ্যমে শুরু থেকেই জব মার্কেটের
              জন্য প্রস্তুত হবে।
            </p>
            <p className="font-bangla text-muted-foreground leading-loose">
              চারটি জায়গাতেই কাজ হয় — একটাও বাদ যায় না।
            </p>

            <div className="border-border/60 mt-10 grid gap-px border-t sm:grid-cols-2">
              {FOCUS.map((item, i) => (
                <div
                  key={item.title}
                  className="border-border/60 min-w-0 py-6 sm:odd:border-r sm:odd:pr-8 sm:even:pl-8"
                >
                  <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.28em]">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="font-bangla mt-3 text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="font-bangla text-muted-foreground mt-2 text-sm leading-loose">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="criteria">
        <SectionLabel index="০২">সিলেকশন প্রসেস</SectionLabel>
        <h2 className="font-bangla mt-6 max-w-3xl text-3xl leading-snug font-bold sm:text-5xl">
          দুইটি শর্ত। দুটোই কঠিন।
        </h2>
        <p className="font-bangla text-muted-foreground mt-5 max-w-2xl leading-loose">
          কোনো ইন্টারভিউ নেই, কোনো আবেদন ফরম নেই। শর্ত পুরোপুরি হিসাবের —
          হয় তুমি পূরণ করেছ, নয়তো করোনি।
        </p>

        <div className="on-scroll mt-14 grid gap-6 lg:grid-cols-2">
          <article className="border-border/70 bg-card/40 relative overflow-hidden rounded-2xl border p-8">
            <div className="hairline absolute inset-x-0 top-0" />
            <p className="font-bangla text-brand-gradient text-5xl font-bold">
              ০১
            </p>
            <h3 className="font-bangla mt-5 text-xl font-semibold">
              Logic &amp; IQ Test
            </h3>
            <p className="font-bangla text-muted-foreground mt-3 leading-loose">
              ২৪ জুলাই Logic &amp; IQ Test-এর এনাউন্সমেন্ট গেছে। যারা দুর্বার
              গ্রুপে যুক্ত হতে চাও, তাদের জন্য এই টেস্টে অংশগ্রহণ করা
              বাধ্যতামূলক।
            </p>
          </article>

          <article className="border-border/70 bg-card/40 relative overflow-hidden rounded-2xl border p-8">
            <div className="hairline absolute inset-x-0 top-0" />
            <p className="font-bangla text-brand-gradient text-5xl font-bold">
              ০২
            </p>
            <h3 className="font-bangla mt-5 text-xl font-semibold">
              Assignment Marks
            </h3>
            <p className="font-bangla text-muted-foreground mt-3 leading-loose">
              Assignment 2-এ{" "}
              <span className="text-foreground font-semibold">60/60</span> এবং
              Assignment 3-এ{" "}
              <span className="text-foreground font-semibold">60/60</span> পেতে
              হবে। অবশ্যই Main Deadline-এর ভেতরে সাবমিট করতে হবে।
            </p>
          </article>
        </div>

        <div className="border-destructive/30 bg-destructive/5 on-scroll mt-6 rounded-2xl border p-8">
          {/* Bengali needs the Bangla face with normal tracking — mono
              letter-spacing breaks its conjuncts apart. */}
          <p className="font-bangla text-destructive text-sm font-semibold">
            যা গ্রহণযোগ্য নয়
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {DISQUALIFIERS.map((item) => (
              <li
                key={item}
                className="font-bangla text-muted-foreground flex gap-3 text-sm leading-relaxed"
              >
                <span aria-hidden className="text-destructive mt-px">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="inside">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel index="০৩">সুবিধা</SectionLabel>
            <h2 className="font-bangla mt-6 max-w-2xl text-3xl leading-snug font-bold sm:text-5xl">
              দুর্বার গ্রুপ তোমাকে কীভাবে এগিয়ে রাখবে?
            </h2>
          </div>
          <p className="font-bangla text-muted-foreground max-w-sm text-sm leading-loose">
            Bootcamp যা দিচ্ছে, তার উপরে এই ছয়টি জিনিস বাড়তি পাবে।
          </p>
        </div>

        <div className="border-border/60 on-scroll mt-14 grid gap-px border-t sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((item) => (
            <article
              key={item.n}
              className="border-border/60 group hover:bg-foreground/[0.03] min-w-0 border-b p-8 transition-colors sm:border-r"
            >
              <p className="font-bangla text-muted-foreground group-hover:text-foreground text-sm transition-colors">
                {item.n}
              </p>
              <h3 className="font-bangla mt-4 text-lg font-semibold">
                {item.title}
              </h3>
              <p className="font-bangla text-muted-foreground mt-3 text-sm leading-loose">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="notes">
        <SectionLabel index="০৪">গুরুত্বপূর্ণ বিষয়</SectionLabel>
        <h2 className="font-bangla mt-6 max-w-3xl text-3xl leading-snug font-bold sm:text-5xl">
          পরিষ্কার করে বলে রাখা ভালো
        </h2>

        <div className="on-scroll mt-14 grid gap-10 lg:grid-cols-3">
          {NOTES.map((item) => (
            <div key={item.title} className="border-mint/40 border-l pl-6">
              <h3 className="font-bangla text-lg font-semibold">
                {item.title}
              </h3>
              <p className="font-bangla text-muted-foreground mt-3 leading-loose">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
