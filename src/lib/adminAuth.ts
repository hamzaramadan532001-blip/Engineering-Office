import { createHash, timingSafeEqual } from "crypto";

// Simple, self-contained gate for the local/dev-only /admin area (see
// app/admin/(protected)/layout.tsx and proxy.ts). This is intentionally NOT
// the real permissions-api auth — it's a stopgap so /admin isn't wide open
// while that lands. Replace with a real `isAdministrator` check on the
// session user before this goes anywhere near production (see PERM-22 note
// in server/nafath/session.ts).
//
// Credentials are read from the environment, never committed as plaintext.
// The dev fallbacks below only apply when the env vars are unset, which is
// fine for local dev but must never be true in a deployed environment.
const DEV_ADMIN_EMAIL = "admin@example.com";
const DEV_ADMIN_PASSWORD = "change-me-in-env";
const DEV_ADMIN_SECRET = "dev-insecure-admin-secret-change-me-in-prod";

export const ADMIN_SESSION_COOKIE = "mmsdi_admin_session";

function getExpectedEmail(): string {
  return process.env.ADMIN_EMAIL ?? DEV_ADMIN_EMAIL;
}

function getExpectedPassword(): string {
  return process.env.ADMIN_PASSWORD ?? DEV_ADMIN_PASSWORD;
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_SESSION_SECRET is required in production — set it (and ADMIN_EMAIL / ADMIN_PASSWORD) as real environment variables, never as literals in source.",
    );
  }
  return DEV_ADMIN_SECRET;
}

/** Constant-time string compare (avoids leaking length/content via timing). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Checks submitted credentials against the configured admin email/password. */
export function checkAdminCredentials(email: string, password: string): boolean {
  return safeEqual(email.trim().toLowerCase(), getExpectedEmail().trim().toLowerCase())
    && safeEqual(password, getExpectedPassword());
}

/** Opaque cookie value proving a successful login — not a JWT, just a marker. */
export function makeAdminSessionToken(): string {
  return createHash("sha256").update(`${getExpectedEmail()}:${getSecret()}`).digest("hex");
}

export function isValidAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  return safeEqual(token, makeAdminSessionToken());
}
