// Encrypted session cookie. On a completed Nafath login the BFF stores the
// permissions-api JWT pair plus the resolved user *inside* an httpOnly cookie,
// sealed as a jose JWE so the tokens are never readable by browser JS and never
// sit in plaintext at rest. The crypto itself lives in
// `@makkah-municipality-gis/session`, shared with the admin portal; this module
// owns only the viewer's payload shape and its validation.
import {
  openSession as openSealed,
  sealSession as sealSealed,
} from "@makkah-municipality-gis/session";

/** The permissions-api user echoed on Nafath status = COMPLETED. */
export interface SessionUser {
  userId: number;
  username: string;
  fullName: string;
  isAdministrator: boolean;
  roles: string[];
}

/** Everything the BFF keeps server-side for a fully authenticated session. */
export interface AuthenticatedSessionData {
  guest?: false;
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/**
 * PERM-22 guest session: a Nafath-verified person with no SDIUSERS row. No
 * token pair — guests only consume public permissions-api endpoints, which
 * take no Authorization header. The sealed cookie itself is the guest's proof
 * of verification.
 */
export interface GuestSessionData {
  guest: true;
  user: SessionUser;
}

export type SessionData = AuthenticatedSessionData | GuestSessionData;

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const u = value as Record<string, unknown>;
  return (
    typeof u.userId === "number" &&
    typeof u.username === "string" &&
    typeof u.fullName === "string" &&
    typeof u.isAdministrator === "boolean" &&
    Array.isArray(u.roles)
  );
}

/** Encrypt a session into a compact JWE string for the cookie value. */
export async function sealSession(
  data: SessionData,
  secret: string,
  ttlSec: number,
): Promise<string> {
  const payload = data.guest
    ? { guest: true, user: data.user }
    : { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  return await sealSealed(payload, secret, ttlSec);
}

/** Rejects a payload whose shape is not exactly one of the two session kinds. */
function isSessionData(value: unknown): value is SessionData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { accessToken, refreshToken, user, guest } = value as Record<string, unknown>;
  if (!isSessionUser(user)) {
    return false;
  }
  if (guest === true) {
    // A guest payload must not smuggle tokens (mixed shapes are rejected).
    return accessToken === undefined && refreshToken === undefined;
  }
  return typeof accessToken === "string" && typeof refreshToken === "string";
}

/** Decrypt a cookie value back into a session, or null if invalid/expired/tampered. */
export async function openSession(token: string, secret: string): Promise<SessionData | null> {
  const payload = await openSealed(token, secret, isSessionData);
  if (!payload) {
    return null;
  }
  return payload.guest
    ? { guest: true, user: payload.user }
    : {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
      };
}
