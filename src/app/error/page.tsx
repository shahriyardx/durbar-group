import { DiscordSignIn } from "@/components/discord-sign-in";
import { CTA_CLASS, PillLink } from "@/components/landing/primitives";

/**
 * Plain-language explanations for the codes better-auth and Discord actually
 * hand back. Anything unmapped still shows its raw code plus a generic
 * next step, so a user is never left staring at a bare slug.
 */
const EXPLANATIONS: Record<
  string,
  { title: string; what: string; fix: string }
> = {
  access_denied: {
    title: "You cancelled the Discord authorisation",
    what: "Discord asked whether Durbar could see your account, and the request was declined or closed before it finished.",
    fix: "Press retry and choose Authorise on the Discord screen.",
  },
  account_banned: {
    title: "This account has been suspended",
    what: "An admin has banned this account from Durbar, so it cannot sign in.",
    fix: "Contact your course admin if you believe this is a mistake.",
  },
  account_not_linked: {
    title: "This Discord account is linked to someone else",
    what: "Another Durbar account already owns this Discord login, so it cannot be attached twice.",
    fix: "Sign in with the Discord account you first used, or ask an admin to unlink the old one.",
  },
  state_mismatch: {
    title: "The sign-in attempt expired",
    what: "The security token that ties your browser to the Discord redirect no longer matches. This normally means the tab sat open too long, or the redirect landed in a different browser.",
    fix: "Press retry and complete the Discord screen in the same tab.",
  },
  invalid_state: {
    title: "The sign-in attempt expired",
    what: "The security token that ties your browser to the Discord redirect is missing or stale.",
    fix: "Press retry and finish the Discord screen without switching browsers.",
  },
  please_restart_the_process: {
    title: "The sign-in attempt could not be resumed",
    what: "The login was interrupted partway through, so it has to start over.",
    fix: "Press retry to begin a fresh sign-in.",
  },
  oauth_code_verification_failed: {
    title: "Discord rejected the login code",
    what: "The one-time code Discord returned could not be exchanged for an account. This usually means the code was already used or it timed out.",
    fix: "Press retry. If it keeps happening, report it to your admin.",
  },
  unable_to_create_user: {
    title: "Your account could not be created",
    what: "Discord authorised you, but Durbar failed to save the account. This is a problem on our side, not yours.",
    fix: "Press retry, and tell your admin the technical code below if it repeats.",
  },
  signup_disabled: {
    title: "New sign-ups are turned off",
    what: "Durbar is not accepting new accounts at the moment.",
    fix: "Ask your course admin to enable access for you.",
  },
  email_not_verified: {
    title: "Your Discord email is not verified",
    what: "Discord will not share an unverified email address, and Durbar needs one to create your account.",
    fix: "Verify your email inside Discord, then press retry.",
  },
};

const FALLBACK = {
  title: "Sign-in did not complete",
  what: "Something went wrong between Durbar and Discord, and the login was stopped before an account could be opened.",
  fix: "Press retry. If it happens again, send your admin the technical details below.",
};

function pick(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ErrorPage({ searchParams }: PageProps<"/error">) {
  const params = await searchParams;
  const code = pick(params.error) ?? pick(params.error_code);
  const description = pick(params.error_description);

  const detail = (code && EXPLANATIONS[code]) || FALLBACK;

  return (
    <main className="grain relative isolate flex flex-1 items-center justify-center overflow-hidden px-6 py-20">
      <div className="brand-glow absolute inset-0 -z-10 opacity-60" />

      <div className="w-full max-w-xl">
        <p className="text-muted-foreground font-mono text-[0.68rem] tracking-[0.32em] uppercase">
          <span className="text-destructive">Error</span>
          <span className="ml-3">Sign-in stopped</span>
        </p>

        <h1 className="font-heading mt-6 text-4xl font-extrabold text-balance">
          {detail.title}
        </h1>

        <p className="text-muted-foreground mt-6 leading-relaxed">
          {detail.what}
        </p>

        <div className="border-border/70 bg-card/40 mt-8 rounded-2xl border p-6">
          <p className="font-mono text-[0.65rem] tracking-[0.28em] uppercase">
            What to do
          </p>
          <p className="mt-3 leading-relaxed">{detail.fix}</p>
        </div>

        {(code || description) && (
          <dl className="border-border/60 mt-6 space-y-3 rounded-2xl border border-dashed p-6 font-mono text-xs">
            <p className="text-muted-foreground tracking-[0.28em] uppercase">
              Technical details
            </p>
            {code ? (
              <div className="flex gap-3">
                <dt className="text-muted-foreground shrink-0">code</dt>
                <dd className="break-all">{code}</dd>
              </div>
            ) : null}
            {description ? (
              <div className="flex gap-3">
                <dt className="text-muted-foreground shrink-0">detail</dt>
                <dd className="break-all">{description}</dd>
              </div>
            ) : null}
          </dl>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <DiscordSignIn
            label="Retry sign-in"
            className={CTA_CLASS}
            callbackURL="/dashboard"
          />
          <PillLink href="/">Back to home</PillLink>
        </div>
      </div>
    </main>
  );
}
