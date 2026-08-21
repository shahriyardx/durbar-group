"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession } = authClient;

export function signInWithDiscord(callbackURL = "/dashboard") {
  return authClient.signIn.social({
    provider: "discord",
    callbackURL,
    // Discord/OAuth failures come back to a page that shows the real reason.
    errorCallbackURL: "/error",
  });
}
