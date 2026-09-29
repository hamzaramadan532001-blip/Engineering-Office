// Server-side client for the permissions-api login/permissions surface.
//
// Every function takes the fetch implementation as an argument so the routes
// pass the real `fetch` while tests inject a stub — no local runtime imports,
// which also lets the Node test runner load this module directly. The base URL
// is passed in from config by the caller (thin proxy, no hidden globals).
import { createHash } from "node:crypto";
import type { AuthenticatedSessionData, SessionUser } from "./session";

const API_PREFIX = "/api/v1";

type FetchImpl = typeof fetch;

export interface StartResult {
  sessionRef: string;
  random: string;
  expiresInSec: number;
}

interface StatusPending {
  status: "WAITING" | "REJECTED" | "EXPIRED" | "ERROR";
}

interface StatusCompleted {
  status: "COMPLETED";
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** PERM-22: verified through Nafath but not registered — no tokens, becomes a guest cookie. */
interface StatusGuest {
  status: "GUEST";
  user: SessionUser;
}

export type StatusResult = StatusPending | StatusCompleted | StatusGuest;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PermissionsMe {
  roles: string[];
  isAdministrator: boolean;
  functions: unknown[];
  mapLayers: unknown[];
  gdbItems: unknown[];
}

/** Outcome of an authenticated `/permissions/me` fetch with refresh-retry. */
export interface PermissionsOutcome {
  /** The permissions payload, or null when the session could not be authenticated. */
  me: PermissionsMe | null;
  /** A rotated token pair when a refresh happened — the caller must re-seal the cookie. */
  rotated: TokenPair | null;
  /** True when the session is unrecoverable and the cookie must be cleared (re-login). */
  cleared: boolean;
}

function url(baseUrl: string, path: string): string {
  return `${baseUrl}${API_PREFIX}${path}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

class UpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** POST /auth/nafath/start — begin a challenge. Passthrough of the start shape. */
export async function nafathStart(
  baseUrl: string,
  fetchImpl: FetchImpl,
  body: { nationalId: string; locale: string },
): Promise<StartResult> {
  const res = await fetchImpl(url(baseUrl, "/auth/nafath/start"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new UpstreamError("nafath_start_failed", res.status);
  }
  const data = await readJson(res);
  return {
    sessionRef: String(data.sessionRef ?? ""),
    random: String(data.random ?? ""),
    expiresInSec: Number(data.expiresInSec ?? 0),
  };
}

/** GET /auth/nafath/status — poll. Returns the raw upstream body (tokens included on COMPLETED). */
export async function nafathStatus(
  baseUrl: string,
  fetchImpl: FetchImpl,
  sessionRef: string,
): Promise<StatusResult> {
  const res = await fetchImpl(
    url(baseUrl, `/auth/nafath/status?sessionRef=${encodeURIComponent(sessionRef)}`),
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new UpstreamError("nafath_status_failed", res.status);
  }
  const data = await readJson(res);
  if (data.status === "COMPLETED") {
    // Both tokens or none. An empty refresh token seals fine and then gets
    // spent on the first 401, which the upstream answers by revoking the whole
    // token family — a silent logout instead of a login that plainly failed.
    if (!data.accessToken || !data.refreshToken) {
      throw new UpstreamError("nafath_status_incomplete", 502);
    }
    return {
      status: "COMPLETED",
      accessToken: String(data.accessToken),
      refreshToken: String(data.refreshToken),
      user: data.user as SessionUser,
    };
  }
  if (data.status === "GUEST") {
    return { status: "GUEST", user: data.user as SessionUser };
  }
  return { status: (data.status as StatusPending["status"]) ?? "ERROR" };
}

/** POST /auth/nafath/resend — new number for the same session. Passthrough of the start shape. */
export async function nafathResend(
  baseUrl: string,
  fetchImpl: FetchImpl,
  sessionRef: string,
): Promise<StartResult> {
  const res = await fetchImpl(url(baseUrl, "/auth/nafath/resend"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionRef }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new UpstreamError("nafath_resend_failed", res.status);
  }
  const data = await readJson(res);
  return {
    // Some resend responses omit sessionRef (it is unchanged) — echo the input.
    sessionRef: String(data.sessionRef ?? sessionRef),
    random: String(data.random ?? ""),
    expiresInSec: Number(data.expiresInSec ?? 0),
  };
}

// Single-flight guard for token refresh. Two parallel requests that both hit a
// 401 must NOT each call /auth/refresh with the same refresh token: the
// permissions-api treats the second exchange as token REUSE and revokes the
// whole token family (intermittent forced logout). Concurrent callers keyed by
// (a hash of) the refresh token share ONE in-flight refresh promise and both
// re-seal the cookie from its result. Per-process only — like the nationalId
// echo Map below, this does not cover multi-instance deploys, where two
// instances can still race; a shared store (or an upstream reuse grace window)
// is the production-scale answer.
const inFlightRefreshes = new Map<string, Promise<TokenPair | null>>();

function refreshKey(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/** Single-flight wrapper around {@link refreshTokens} — see the note above. */
export function refreshTokensSingleFlight(
  baseUrl: string,
  fetchImpl: FetchImpl,
  refreshToken: string,
): Promise<TokenPair | null> {
  const key = refreshKey(refreshToken);
  const existing = inFlightRefreshes.get(key);
  if (existing) {
    return existing;
  }
  const flight = refreshTokens(baseUrl, fetchImpl, refreshToken).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, flight);
  return flight;
}

/** POST /auth/refresh — exchange a refresh token for a new pair, or null on failure. */
export async function refreshTokens(
  baseUrl: string,
  fetchImpl: FetchImpl,
  refreshToken: string,
): Promise<TokenPair | null> {
  const res = await fetchImpl(url(baseUrl, "/auth/refresh"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  const data = await readJson(res);
  if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") {
    return null;
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

/** POST /auth/logout — revoke the session's refresh tokens (best-effort; Bearer auth). */
export async function logoutRemote(
  baseUrl: string,
  fetchImpl: FetchImpl,
  accessToken: string,
): Promise<void> {
  await fetchImpl(url(baseUrl, "/auth/logout"), {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

async function getPermissionsMe(
  baseUrl: string,
  fetchImpl: FetchImpl,
  accessToken: string,
): Promise<Response> {
  return await fetchImpl(url(baseUrl, "/permissions/me"), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

/**
 * GET /permissions/me with the session's access token. On a 401 it refreshes via
 * /auth/refresh and retries once; if the refresh (or the retry) fails the session
 * is unrecoverable and `cleared` is set so the caller drops the cookie.
 */
export async function fetchPermissionsMe(
  baseUrl: string,
  fetchImpl: FetchImpl,
  session: AuthenticatedSessionData,
): Promise<PermissionsOutcome> {
  let res = await getPermissionsMe(baseUrl, fetchImpl, session.accessToken);

  if (res.status !== 401) {
    if (!res.ok) {
      throw new UpstreamError("permissions_me_failed", res.status);
    }
    return { me: (await readJson(res)) as unknown as PermissionsMe, rotated: null, cleared: false };
  }

  // Access token expired — refresh (single-flight per refresh token so
  // concurrent 401s don't trigger a reuse-revocation upstream), then retry once.
  const rotated = await refreshTokensSingleFlight(baseUrl, fetchImpl, session.refreshToken);
  if (!rotated) {
    return { me: null, rotated: null, cleared: true };
  }

  res = await getPermissionsMe(baseUrl, fetchImpl, rotated.accessToken);
  if (!res.ok) {
    return { me: null, rotated: null, cleared: true };
  }
  return { me: (await readJson(res)) as unknown as PermissionsMe, rotated, cleared: false };
}

/**
 * GET /permissions/public — the Public role's grants, no Authorization header
 * (the endpoint is @Public and 60s-cached upstream). Backs guest sessions.
 */
export async function fetchPermissionsPublic(
  baseUrl: string,
  fetchImpl: FetchImpl,
): Promise<PermissionsMe> {
  const res = await fetchImpl(url(baseUrl, "/permissions/public"), { cache: "no-store" });
  if (!res.ok) {
    throw new UpstreamError("permissions_public_failed", res.status);
  }
  return (await readJson(res)) as unknown as PermissionsMe;
}

/**
 * Map a raw upstream status into the browser-facing body — deliberately drops
 * accessToken/refreshToken so the JWTs never reach browser JS. A GUEST result
 * is reported to the browser as COMPLETED: the frozen login client maps any
 * unknown status string to "rejected", and guest-ness is a server-side fact
 * (the sealed cookie), not a login-screen outcome.
 */
export function toBrowserStatus(
  result: StatusResult,
  nationalId: string | null,
): { status: string; user?: { nationalId: string | null; fullNameAr: string | null } } {
  if (result.status !== "COMPLETED" && result.status !== "GUEST") {
    return { status: result.status };
  }
  return {
    status: "COMPLETED",
    user: { nationalId, fullNameAr: result.user?.fullName ?? null },
  };
}

// Best-effort echo of the national ID on the browser status response. The
// permissions-api status payload does not carry it (it is the login input, not
// part of the profile), so the BFF remembers it between start and status. Dev
// in-memory only — the same limitation as the mock store; prod state is durable
// in the permissions-api keyed by sessionRef.
const startNationalIds = new Map<string, string>();

export function rememberStartNationalId(sessionRef: string, nationalId: string): void {
  if (sessionRef) {
    startNationalIds.set(sessionRef, nationalId);
  }
}

export function takeStartNationalId(sessionRef: string): string | null {
  const value = startNationalIds.get(sessionRef) ?? null;
  startNationalIds.delete(sessionRef);
  return value;
}
