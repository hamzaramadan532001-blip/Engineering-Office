/**
 * The admin session cookie, for the ID-number login.
 *
 * The pre-existing `/admin` gate stores a FIXED opaque hash (see lib/adminAuth.ts) — the
 * same value for everyone, carrying no identity. That is fine for "is this an admin at all",
 * but it cannot answer "which department is this admin in", which is the whole point of
 * logging in with an ID number.
 *
 * So an ID login seals the employee's IDENTITY_NO into the cookie instead, using the same
 * JWE machinery the viewer's session uses. Only the identity is sealed: the employee's name,
 * DEPT_ID and department name are re-read from the service whenever they are needed, so an
 * HR change is never left stale inside somebody's cookie for eight hours.
 *
 * Both cookie shapes are accepted by the gate (see `readAdminSession`), so the existing
 * email/password login keeps working exactly as before.
 */

import { getSessionSecret, openSession, sealSession } from "@/server/nafath";
import { isValidAdminSessionToken } from "@/lib/adminAuth";

/** 8 hours — matches the TTL the email/password login already used. */
export const ADMIN_SESSION_TTL_SEC = 60 * 60 * 8;

export type AdminSessionIdentity = {
  /** IDENTITY_NO of the signed-in employee, or null for the legacy credential login. */
  identityNo: string | null;
};

/** Seals an employee ID login into a cookie value. */
export async function sealAdminSession(identityNo: string, fullName: string): Promise<string> {
  return sealSession(
    {
      guest: true,
      user: {
        userId: 0,
        // The identity the session is re-read from.
        username: identityNo,
        fullName,
        isAdministrator: true,
        roles: [],
      },
    },
    getSessionSecret(),
    ADMIN_SESSION_TTL_SEC,
  );
}

/**
 * Validates an admin cookie and says who it belongs to.
 *
 * Returns `null` when the cookie is absent or invalid. `identityNo: null` means a valid
 * LEGACY credential session — an admin, but with no employee record behind it, so no
 * department can be derived for it.
 */
export async function readAdminSession(
  raw: string | undefined,
): Promise<AdminSessionIdentity | null> {
  if (!raw) return null;

  // Legacy first: it is a cheap constant-time comparison, and it is what an existing
  // email/password session presents.
  if (isValidAdminSessionToken(raw)) {
    return { identityNo: null };
  }

  try {
    const session = await openSession(raw, getSessionSecret());
    if (!session?.user?.isAdministrator) return null;

    const identityNo = session.user.username?.trim();
    return identityNo ? { identityNo } : null;
  } catch {
    // Not a JWE either — an expired or forged cookie. Not an error worth logging loudly.
    return null;
  }
}
