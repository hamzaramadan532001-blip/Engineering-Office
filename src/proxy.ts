import { type NextRequest, NextResponse } from "next/server";
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) {
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
