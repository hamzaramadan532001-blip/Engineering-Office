// Session-cookie config + the permissions-api switch.
//
// When PERMISSIONS_API_URL is set, the Nafath BFF routes proxy to the
// permissions-api (which owns the real Nafath/hmm gateway, the Oracle identity
// mapping and JWT issuance — see docs/nafath-integration.md). When it is unset
// there is no backend, so the routes fall back to the in-process dev mock.
// PERMISSIONS_ENFORCEMENT=off runs the viewer with gating switched off on purpose.
// All of these are read server-side only — never expose them to the browser.
export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "mmsdi_session";

// Cookie/JWE lifetime. Defaults to 30 days to match the permissions-api's
// refresh-token horizon (JWT_REFRESH_TTL=30d): the session lives as long as its
// refresh token can still rotate. Overriding to a shorter value is a valid
// product choice (idle logout) but note the upstream refresh token it seals is
// then orphaned until it expires server-side.
export const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC ?? 2_592_000);
// PERM-22: guest sessions hold no refresh token, so they cannot rotate — keep
// them short (4h default) and let the person re-verify through Nafath.
export const GUEST_SESSION_TTL_SEC = Number(process.env.GUEST_SESSION_TTL_SEC ?? 14_400);
export const MOCK_EXPIRY_SEC = Number(process.env.NAFATH_MOCK_EXPIRY_SEC ?? 60);

/** Base URL of the permissions-api (e.g. http://localhost:3001). Trailing slashes trimmed. */
export const PERMISSIONS_API_URL = (process.env.PERMISSIONS_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

/** True when a real permissions-api is configured; false ⇒ use the local dev mock. */
export function isPermissionsApiConfigured(): boolean {
  return PERMISSIONS_API_URL.length > 0;
}

/** Accepted PERMISSIONS_ENFORCEMENT values. Absence means "on" — never "off". */
export type PermissionsEnforcement = "on" | "off";

/**
 * How the permissions envelope is served: real grants, the dev no-grants mock, or
 * gating deliberately switched off for a deploy that ships before the
 * permissions-api exists. Only "real" enforces anything.
 */
export type PermissionsMode = "real" | "mock" | "unenforced";

/**
 * Parse PERMISSIONS_ENFORCEMENT. Only a literal "off" disables gating: absence is
 * "on", and any other value throws instead of being guessed at, so a typo can never
 * read as the fail-open it resembles.
 */
function parseEnforcement(raw: string | undefined): PermissionsEnforcement {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.length === 0 || value === "on") {
    return "on";
  }
  if (value === "off") {
    return "off";
  }
  throw new Error(
    `PERMISSIONS_ENFORCEMENT must be "on" or "off" (got "${raw}"). Leave it unset to keep permission gating on — no other value turns it off.`,
  );
}

/**
 * Resolve the permissions mode. Pure (env passed in) so the policy is unit-testable.
 * An unset PERMISSIONS_API_URL means "no grants exist", which turns OFF the PERM-21
 * widget/layer gating — a dev convenience that must never reach production.
 */
export function resolvePermissionsMode(env: {
  permissionsApiUrl: string;
  nodeEnv: string | undefined;
  enforcement: string | undefined;
}): PermissionsMode {
  // Precedence: an explicit PERMISSIONS_ENFORCEMENT=off beats a configured
  // PERMISSIONS_API_URL — it is the deliberate operator signal, and the viewer must
  // behave the same whether or not the service happens to answer.
  if (parseEnforcement(env.enforcement) === "off") {
    return "unenforced";
  }
  if (env.permissionsApiUrl.trim().length > 0) {
    return "real";
  }
  if (env.nodeEnv === "production") {
    throw new Error(
      "PERMISSIONS_API_URL is required in production — without it the session carries no grants, so every gated widget and layer would be shown to everyone. Set PERMISSIONS_API_URL to the permissions-api base URL, or set PERMISSIONS_ENFORCEMENT=off to run deliberately unenforced.",
    );
  }
  return "mock";
}

/** Why gating is off, shouted once per process. The banner is the user's copy (rule 14). */
const UNENFORCED_LOG: Record<Exclude<PermissionsMode, "real">, string> = {
  unenforced:
    "[permissions] PERMISSIONS_ENFORCEMENT=off — permission gating is DISABLED: every widget and layer is visible to everyone and the session is presence-only. Never run this once the permissions-api is live.",
  mock: "[permissions] PERMISSIONS_API_URL is unset — serving the dev permissions mock: gating is DISABLED and every widget and layer is visible.",
};

let announcedMode: PermissionsMode | null = null;

function announceUnenforcedOnce(mode: PermissionsMode): void {
  if (mode === "real" || announcedMode === mode) {
    return;
  }
  announcedMode = mode;
  console.error(UNENFORCED_LOG[mode]);
}

/**
 * Mode for this process, validated against NODE_ENV. Read at call time (not module
 * load) so a production deploy missing PERMISSIONS_API_URL fails loudly on first use
 * instead of silently serving an ungated UI.
 */
export function getPermissionsMode(): PermissionsMode {
  const mode = resolvePermissionsMode({
    permissionsApiUrl: PERMISSIONS_API_URL,
    nodeEnv: process.env.NODE_ENV,
    enforcement: process.env.PERMISSIONS_ENFORCEMENT,
  });
  announceUnenforcedOnce(mode);
  return mode;
}

// Committed dev-only fallback — acceptable ONLY in mock mode, where the cookie
// is an opaque marker and no real JWTs exist. With a real permissions-api the
// cookie seals real JWTs, so encrypting with a committed constant would make
// every session decryptable AND forgeable by anyone who can read the repo.
const DEV_SESSION_SECRET = "dev-insecure-session-secret-change-me-in-prod";
const MIN_SECRET_BYTES = 32;

/**
 * Resolve the session-cookie encryption secret. Pure (env passed in) so the
 * policy is unit-testable:
 * - mock mode (no permissions-api): any secret, falling back to the dev default;
 * - real-API mode: SESSION_SECRET is REQUIRED, must be >= 32 bytes, and must not
 *   be the committed dev default — otherwise throw a clear error naming the var.
 */
export function resolveSessionSecret(env: {
  permissionsApiUrl: string;
  sessionSecret: string | undefined;
}): string {
  const secret = (env.sessionSecret ?? "").trim();
  if (env.permissionsApiUrl.trim().length === 0) {
    return secret.length > 0 ? secret : DEV_SESSION_SECRET;
  }
  if (secret.length === 0) {
    throw new Error(
      "SESSION_SECRET is required when PERMISSIONS_API_URL is set — the session cookie seals real JWTs. Set SESSION_SECRET to a strong random value (>= 32 bytes).",
    );
  }
  if (secret === DEV_SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET must not be the committed dev default when PERMISSIONS_API_URL is set. Set SESSION_SECRET to a strong random value (>= 32 bytes).",
    );
  }
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(
      `SESSION_SECRET is too short for real-token mode (need >= ${MIN_SECRET_BYTES} bytes). Set SESSION_SECRET to a strong random value.`,
    );
  }
  return secret;
}

/**
 * Secret used to encrypt the session cookie (jose JWE; hashed to a 32-byte key).
 * Read at call time (not module load) and validated against the mode — throws on
 * first use when a real permissions-api is configured without a proper secret.
 */
export function getSessionSecret(): string {
  return resolveSessionSecret({
    permissionsApiUrl: PERMISSIONS_API_URL,
    sessionSecret: process.env.SESSION_SECRET,
  });
}
