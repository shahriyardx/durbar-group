import Link from "next/link";

import { DiscordSignIn } from "@/components/discord-sign-in";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#mission", label: "মিশন" },
  { href: "#criteria", label: "সিলেকশন" },
  { href: "#inside", label: "সুবিধা" },
  { href: "#notes", label: "গুরুত্বপূর্ণ" },
];

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-border/50 bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-bangla text-brand-gradient text-lg font-bold">
            দুর্বার
          </span>
          <span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.3em] uppercase">
            Group
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground font-bangla text-sm transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto">
          {signedIn ? (
            <Button
              asChild
              className="bg-brand-gradient font-bangla h-9 rounded-full px-5 text-white hover:opacity-90"
            >
              <Link href="/dashboard">ড্যাশবোর্ড</Link>
            </Button>
          ) : (
            <DiscordSignIn
              label="জয়েন করো"
              className="font-bangla h-9 rounded-full px-5"
            />
          )}
        </div>
      </div>
    </header>
  );
}
