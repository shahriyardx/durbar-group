import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared geometry for every call to action, so the filled Discord button and
 * the outline links are always exactly the same height.
 */
export const CTA_CLASS = "h-12 rounded-full px-7 text-sm";

export function PillLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        CTA_CLASS,
        "font-mono text-[0.72rem] tracking-[0.2em] uppercase",
        className,
      )}
    >
      {href.startsWith("#") ? (
        <a href={href}>{children}</a>
      ) : (
        <Link href={href}>{children}</Link>
      )}
    </Button>
  );
}

/** Mono, letter-spaced index label — the spec-sheet voice of the page. */
export function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    // Bengali numerals have no glyphs in JetBrains Mono, so the label runs in
    // the Bangla face and drops the mono tracking.
    <p className="font-bangla text-sm">
      <span className="text-brand-gradient font-bold">{index}</span>
      <span className="text-muted-foreground ml-3">{children}</span>
    </p>
  );
}

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "border-border/60 relative border-t px-6 py-20 sm:py-28",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
