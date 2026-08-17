"use client";

import { useEffect, useState } from "react";

import { countdownBn } from "@/lib/format";

/**
 * Ticking deadline. The server renders the first value so there is no blank
 * frame, and the browser takes over a second later — the two are computed by
 * the same function, a second apart, so the text is expected to differ across
 * hydration and the warning is suppressed deliberately.
 */
export function Countdown({ dueAt, initial }: { dueAt: Date; initial: string }) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => setLabel(countdownBn(dueAt)), 1000);
    return () => clearInterval(id);
  }, [dueAt]);

  return (
    <span suppressHydrationWarning className="tabular-nums">
      {label}
    </span>
  );
}
