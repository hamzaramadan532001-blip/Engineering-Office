// server/nafath entry point.
//
// The BFF talks to the permissions-api when PERMISSIONS_API_URL is set;
// otherwise it falls back to the in-process mock (no dev Nafath gateway exists).
// The permissions-api owns the real Nafath (hmm gateway), the Oracle identity
// mapping and JWT issuance — see docs/nafath-integration.md.

export * as permissionsApi from "./api-client";
export type { PermissionsEnforcement, PermissionsMode } from "./config";
export {
  GUEST_SESSION_TTL_SEC,
  getPermissionsMode,
  getSessionSecret,
  isPermissionsApiConfigured,
  MOCK_EXPIRY_SEC,
  PERMISSIONS_API_URL,
  resolvePermissionsMode,
  resolveSessionSecret,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
} from "./config";
export type {
  AuthenticatedSessionData,
  GuestSessionData,
  SessionData,
  SessionUser,
} from "./session";
export { openSession, sealSession } from "./session";
