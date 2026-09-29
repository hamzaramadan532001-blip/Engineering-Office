import { type NextRequest, NextResponse } from "next/server";
import {
  getPermissionsMode,
  getSessionSecret,
  openSession,
  PERMISSIONS_API_URL,
  permissionsApi,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  sealSession,
} from "@/server/nafath";

// The session/user endpoint. Returns the logged-in user plus the permissions the
// UI gates on ({functions, mapLayers, isAdministrator}), fetched server-side from
// the permissions-api with the access token from the sealed cookie. On a 401 it
// refreshes and rewrites the cookie; on refresh failure it clears the cookie so
// the client re-logs in. Tokens never cross this boundary to the browser.
function unauthenticated(clearCookie: boolean): NextResponse {
  const res = NextResponse.json({ authenticated: false }, { status: 401 });
  if (clearCookie) {
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return unauthenticated(false);
  }

  // Gating off — the dev mock, or an explicit PERMISSIONS_ENFORCEMENT=off deploy that
  // ships before the permissions-api exists. No backend is consulted either way, so
  // "authenticated" is PRESENCE-ONLY: any non-empty cookie passes, nothing is verified.
  const mode = getPermissionsMode();
  if (mode !== "real") {
    return NextResponse.json({
      authenticated: true,
      user: null,
      roles: [],
      functions: [],
      mapLayers: [],
      isAdministrator: false,
      mock: mode === "mock",
      enforcement: "off",
    });
  }

  // Throws with a clear message when SESSION_SECRET is missing/weak in real-API
  // mode — surfacing the misconfiguration instead of sealing JWTs insecurely.
  const sessionSecret = getSessionSecret();

  const session = await openSession(raw, sessionSecret);
  if (!session) {
    return unauthenticated(true);
  }

  // PERM-22 guest: no tokens to send or rotate — the permissions are the Public
  // role's grants, fetched with no Authorization header. Same envelope as an
  // authenticated user (plus guest:true) so the UI needs no special path.
  if (session.guest) {
    let publicPermissions: Awaited<ReturnType<typeof permissionsApi.fetchPermissionsPublic>>;
    try {
      publicPermissions = await permissionsApi.fetchPermissionsPublic(PERMISSIONS_API_URL, fetch);
    } catch {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    return NextResponse.json({
      authenticated: true,
      guest: true,
      user: {
        userId: session.user.userId,
        username: session.user.username,
        fullName: session.user.fullName,
      },
      isAdministrator: false,
      roles: publicPermissions.roles ?? [],
      functions: publicPermissions.functions,
      mapLayers: publicPermissions.mapLayers,
      enforcement: "on",
    });
  }

  let outcome: Awaited<ReturnType<typeof permissionsApi.fetchPermissionsMe>>;
  try {
    outcome = await permissionsApi.fetchPermissionsMe(PERMISSIONS_API_URL, fetch, session);
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  if (outcome.cleared || !outcome.me) {
    return unauthenticated(true);
  }

  const res = NextResponse.json({
    authenticated: true,
    user: {
      userId: session.user.userId,
      username: session.user.username,
      fullName: session.user.fullName,
    },
    isAdministrator: outcome.me.isAdministrator,
    roles: outcome.me.roles ?? [],
    functions: outcome.me.functions,
    mapLayers: outcome.me.mapLayers,
    enforcement: "on",
  });

  // Refresh happened — re-seal the cookie with the rotated tokens.
  if (outcome.rotated) {
    const sealed = await sealSession(
      { ...session, ...outcome.rotated },
      sessionSecret,
      SESSION_TTL_SEC,
    );
    res.cookies.set(SESSION_COOKIE, sealed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    });
  }

  return res;
}
