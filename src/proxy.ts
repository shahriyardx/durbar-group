import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only — it checks that a session cookie exists, nothing more.
 * Role and verification checks live in the server components under
 * src/lib/rbac.ts, which actually read the session from the database.
 */
export function proxy(request: NextRequest) {
  const hasSession = getSessionCookie(request);
  if (hasSession) return NextResponse.next();

  // There is no login page — the landing page is where you sign in.
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/instructor/:path*", "/student/:path*", "/verify"],
};
