"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signInWithDiscord } from "@/lib/auth-client";

export function DiscordSignIn({
  callbackURL = "/",
  label = "Continue with Discord",
  className,
  size = "lg",
}: {
  callbackURL?: string;
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const { error } = await signInWithDiscord(callbackURL);
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Could not start Discord sign-in.");
    }
  }

  return (
    <Button
      size={size}
      className={cn(
        "bg-brand-gradient text-white transition-opacity hover:opacity-90",
        className,
      )}
      disabled={pending}
      onClick={onClick}
    >
      <DiscordMark />
      {pending ? "Redirecting…" : label}
    </Button>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-current">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.2.36-.43.842-.59 1.226a18.27 18.27 0 0 0-5.487 0A12.6 12.6 0 0 0 9.21 3a19.74 19.74 0 0 0-4.435 1.372C1.96 8.578 1.19 12.68 1.575 16.723a19.9 19.9 0 0 0 6.073 3.084c.49-.669.927-1.38 1.303-2.126a12.9 12.9 0 0 1-2.051-.985c.172-.126.34-.258.503-.393a14.2 14.2 0 0 0 12.195 0c.165.137.334.269.505.393-.655.386-1.343.716-2.055.986a15.5 15.5 0 0 0 1.304 2.125 19.84 19.84 0 0 0 6.076-3.084c.452-4.687-.772-8.752-3.111-12.354ZM8.68 14.267c-1.196 0-2.18-1.096-2.18-2.442 0-1.346.962-2.443 2.18-2.443 1.219 0 2.202 1.106 2.181 2.443 0 1.346-.962 2.442-2.18 2.442Zm6.64 0c-1.196 0-2.18-1.096-2.18-2.442 0-1.346.963-2.443 2.18-2.443 1.22 0 2.203 1.106 2.182 2.443 0 1.346-.953 2.442-2.181 2.442Z" />
    </svg>
  );
}
