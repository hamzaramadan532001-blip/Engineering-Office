// Encrypted session cookies, shared by the viewer and the admin portal. The
// session payload is sealed as a jose JWE (dir + A256GCM) so its contents —
// permissions-api JWTs included — are unreadable by browser JS and never sit in
// plaintext at rest. There is no server-side store: the cookie IS the session,
// so restarts keep people logged in and any instance can serve any request.
//
// The payload shape is the caller's business: each app passes its own type
// guard to `openSession`, so a cookie that does not match is rejected rather
// than trusted. Deliberately free of framework imports (only `jose` + node
// builtins) so it can be exercised by the Node test runner.
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

/** Narrows a decrypted payload to the caller's session shape. */
export type SessionGuard<T> = (value: unknown) => value is T;

/** Derive a stable 32-byte key from any-length secret (A256GCM needs 256 bits). */
function keyFromSecret(secret: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

/** Encrypt a session into a compact JWE string for the cookie value. */
export async function sealSession<T extends Record<string, unknown>>(
  data: T,
  secret: string,
  ttlSec: number,
): Promise<string> {
  return await new EncryptJWT(data)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .encrypt(keyFromSecret(secret));
}

/**
 * Decrypt a cookie value back into a session, or `null` when it is invalid,
 * expired, tampered with, or does not match `isSession`. Every failure reads
 * the same to the caller: an unauthenticated request.
 */
export async function openSession<T>(
  token: string,
  secret: string,
  isSession: SessionGuard<T>,
): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, keyFromSecret(secret));
    return isSession(payload) ? payload : null;
  } catch {
    return null;
  }
}

const MIN_SECRET_BYTES = 32;

export interface SessionSecretEnv {
  /** Empty means "no real upstream configured" — mock mode, where a dev default is fine. */
  upstreamUrl: string;
  sessionSecret: string | undefined;
  /** The committed dev default, refused once a real upstream is configured. */
  devDefault: string;
}

/**
 * Resolves the cookie-sealing secret, refusing a weak or default one as soon as
 * real tokens are involved. Called at use time rather than module load so a
 * build that never serves a request does not need the secret set.
 */
export function resolveSessionSecret(env: SessionSecretEnv): string {
  const secret = (env.sessionSecret ?? "").trim();
  if (env.upstreamUrl.trim().length === 0) {
    return secret.length > 0 ? secret : env.devDefault;
  }
  if (secret.length === 0) {
    throw new Error(
      "SESSION_SECRET is required when a real permissions-api is configured — the session cookie seals real JWTs. Set it to a strong random value (>= 32 bytes).",
    );
  }
  if (secret === env.devDefault) {
    throw new Error(
      "SESSION_SECRET must not be the committed dev default when a real permissions-api is configured. Set it to a strong random value (>= 32 bytes).",
    );
  }
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(
      `SESSION_SECRET is too short for real-token mode (need >= ${MIN_SECRET_BYTES} bytes). Set it to a strong random value.`,
    );
  }
  return secret;
}
