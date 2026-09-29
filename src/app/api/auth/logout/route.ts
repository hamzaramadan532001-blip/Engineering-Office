import { type NextRequest, NextResponse } from "next/server";
import {
  getSessionSecret,
  isPermissionsApiConfigured,
  openSession,
  PERMISSIONS_API_URL,
  permissionsApi,
  SESSION_COOKIE,
} from "@/server/nafath";

// End the session: revoke the refresh tokens on the permissions-api (when
// configured), then clear the cookie. The cookie is always cleared — even if
// the upstream revoke fails or the session secret is misconfigured.
export async function POST(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;

  if (raw && isPermissionsApiConfigured()) {
    try {
      const session = await openSession(raw, getSessionSecret());
      // PERM-22: a guest session has no refresh token to revoke — cookie
      // clearing below is the whole logout.
      if (session && !session.guest) {
        await permissionsApi.logoutRemote(PERMISSIONS_API_URL, fetch, session.accessToken);
      }
    } catch {
      // Best-effort revoke — never block logout on an upstream failure or a
      // misconfigured SESSION_SECRET (getSessionSecret throws in that case).
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
