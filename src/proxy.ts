import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { SESSION_COOKIE } from "@/server/nafath/config";

// Next 16 proxy (renamed middleware): optimistic gate only — redirect to /login
// when the session cookie is absent; the backend does real authorization.
//
// /admin and /api/admin are local/dev-only (see app/admin/(protected)/page.tsx)
// and are deliberately left out of this session gate so they're reachable
// without a Nafath session. /admin now has its own hardcoded-credential login
// (see app/admin/login and lib/adminAuth.ts) — that is a stopgap, not a real
// admin-role check. Never rely on it outside local dev; wire up a real
// `isAdministrator` check on the session user before this goes anywhere near
// production.
const PUBLIC_PATHS = [
  /^\/login(?:\/.*)?$/,
  /^\/api\/auth(?:\/.*)?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/api\/admin(?:\/.*)?$/,
];

/**
 * A request's files (`/api/requests/{id}/attachments…`) are read by TWO kinds of user: the
 * office that owns the request (office session) and a municipality reviewer signed into
 * /admin (admin session only — no office cookie). Without this exception every reviewer
 * who is not ALSO logged in as an office was redirected to /login, and the file list read
 * the login page as "no attachments".
 *
 * Optimistic like the rest of this gate: the cookie's presence only lets the request
 * through; the route itself validates the session and who may see the request
 * (server/requestAccess.ts).
 */
const ADMIN_READABLE_PATHS = [/^\/api\/requests\/\d+\/attachments(?:\/\d+)?$/];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  if (
    ADMIN_READABLE_PATHS.some((re) => re.test(pathname)) &&
    req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  ) {
    return NextResponse.next();
  }

  if (req.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, static files (anything with an extension), and figma assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|figma-assets|.*\\.[\\w]+$).*)"],
};
