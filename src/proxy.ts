import { NextRequest, NextResponse } from "next/server";

// BotID injects its client challenge/proxy requests under this fixed prefix
// (hardcoded in the botid package). withBotId() rewrites it in next.config, but
// middleware runs *before* rewrites — so without this guard we'd redirect the
// challenge to /login, the token never resolves, and checkBotId() flags real
// users as bots (the /api/auth/register "Access denied" 403).
const BOTID_PREFIX =
  "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3";

// Auth pages are reachable without a session; everything else (the app) needs
// one. This is a cookie-presence check for redirect UX only — actual session
// validation happens in route handlers via getCurrentUser().
const AUTH_PAGES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  // Invite links must be reachable without a session — the page itself
  // forwards valid invites on to /register.
  "/invite",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never touch BotID's challenge/proxy paths — let withBotId's rewrites handle them.
  if (pathname.startsWith(BOTID_PREFIX)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("session")?.value);
  const isAuthPage = AUTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isAuthPage) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
