// Unit tests for the permissions-api client. Run with `pnpm --filter gis-viewer test`
// (Node's built-in test runner — no extra framework). Fetch is injected as a stub.
//
// This is a .mjs file so the Node runner type-strips the imported .ts modules and
// tsc (which only includes .ts/.tsx/.mts) leaves it alone.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchPermissionsMe,
  fetchPermissionsPublic,
  logoutRemote,
  nafathResend,
  nafathStart,
  nafathStatus,
  refreshTokens,
  refreshTokensSingleFlight,
  rememberStartNationalId,
  takeStartNationalId,
  toBrowserStatus,
} from "./api-client.ts";

const BASE = "http://permissions-api.test";
const USER = {
  userId: 7,
  username: "fadel.ghandour",
  fullName: "فاضل غندور",
  isAdministrator: true,
  roles: ["Administrator"],
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** A fetch stub that replays a queue of responses and records every call. */
function makeFetch(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const res = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return res;
  };
  fn.calls = calls;
  return fn;
}

test("nafathStart proxies the start shape and posts nationalId + locale", async () => {
  const f = makeFetch([jsonResponse(200, { sessionRef: "s1", random: "47", expiresInSec: 180 })]);
  const out = await nafathStart(BASE, f, { nationalId: "1234567890", locale: "ar" });

  assert.deepEqual(out, { sessionRef: "s1", random: "47", expiresInSec: 180 });
  assert.equal(f.calls[0].url, `${BASE}/api/v1/auth/nafath/start`);
  assert.equal(f.calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { nationalId: "1234567890", locale: "ar" });
});

test("nafathStart throws on upstream error", async () => {
  const f = makeFetch([jsonResponse(500, {})]);
  await assert.rejects(() => nafathStart(BASE, f, { nationalId: "1234567890", locale: "ar" }));
});

test("nafathStatus passes WAITING through", async () => {
  const f = makeFetch([jsonResponse(200, { status: "WAITING" })]);
  const out = await nafathStatus(BASE, f, "s1");
  assert.deepEqual(out, { status: "WAITING" });
  assert.equal(f.calls[0].url, `${BASE}/api/v1/auth/nafath/status?sessionRef=s1`);
});

test("nafathStatus returns tokens + user on COMPLETED", async () => {
  const f = makeFetch([
    jsonResponse(200, {
      status: "COMPLETED",
      accessToken: "acc",
      refreshToken: "ref",
      user: USER,
    }),
  ]);
  const out = await nafathStatus(BASE, f, "s1");
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.accessToken, "acc");
  assert.equal(out.refreshToken, "ref");
  assert.deepEqual(out.user, USER);
});

test("nafathStatus rejects a COMPLETED that is missing the refresh token", async () => {
  const f = makeFetch([jsonResponse(200, { status: "COMPLETED", accessToken: "acc", user: USER })]);
  // An empty refresh token would seal fine and revoke the token family on the
  // first 401 — failing the login is the honest outcome.
  await assert.rejects(() => nafathStatus(BASE, f, "s1"));
});

test("nafathStatus rejects a COMPLETED that is missing the access token", async () => {
  const f = makeFetch([
    jsonResponse(200, { status: "COMPLETED", refreshToken: "ref", user: USER }),
  ]);
  await assert.rejects(() => nafathStatus(BASE, f, "s1"));
});

test("nafathResend echoes the input sessionRef when the response omits it", async () => {
  const f = makeFetch([jsonResponse(200, { random: "31", expiresInSec: 180 })]);
  const out = await nafathResend(BASE, f, "s1");
  assert.deepEqual(out, { sessionRef: "s1", random: "31", expiresInSec: 180 });
  assert.equal(f.calls[0].url, `${BASE}/api/v1/auth/nafath/resend`);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { sessionRef: "s1" });
});

test("toBrowserStatus strips the JWTs from the browser response", () => {
  const completed = {
    status: "COMPLETED",
    accessToken: "acc",
    refreshToken: "ref",
    user: USER,
  };
  const body = toBrowserStatus(completed, "1234567890");
  assert.deepEqual(body, {
    status: "COMPLETED",
    user: { nationalId: "1234567890", fullNameAr: "فاضل غندور" },
  });
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("acc"));
  assert.ok(!serialized.includes("ref"));
  assert.ok(!serialized.includes("accessToken"));
});

test("toBrowserStatus passes non-completed status through with no user", () => {
  assert.deepEqual(toBrowserStatus({ status: "REJECTED" }, null), { status: "REJECTED" });
});

const GUEST_USER = {
  userId: 0,
  username: "guest",
  fullName: "زائر كريم",
  isAdministrator: false,
  roles: [],
};

test("PERM-22: nafathStatus parses the GUEST arm (user, no tokens)", async () => {
  const f = makeFetch([jsonResponse(200, { status: "GUEST", user: GUEST_USER })]);
  const out = await nafathStatus(BASE, f, "s1");
  assert.deepEqual(out, { status: "GUEST", user: GUEST_USER });
});

test("PERM-22: toBrowserStatus reports GUEST as COMPLETED (frozen UI maps unknown statuses to rejected)", () => {
  const body = toBrowserStatus({ status: "GUEST", user: GUEST_USER }, "2111111111");
  assert.deepEqual(body, {
    status: "COMPLETED",
    user: { nationalId: "2111111111", fullNameAr: "زائر كريم" },
  });
  assert.ok(!JSON.stringify(body).includes("accessToken"));
});

test("PERM-22: fetchPermissionsPublic hits /permissions/public with NO Authorization header", async () => {
  const grants = {
    roles: [],
    isAdministrator: false,
    functions: [{ functionName: "Locator", functionNameAr: "تحديد المواقع" }],
    mapLayers: [{ mapServiceLayerName: "Roads", mapServiceUrl: "http://gis.test/MapServer" }],
    gdbItems: [],
  };
  const f = makeFetch([jsonResponse(200, grants)]);
  const out = await fetchPermissionsPublic(BASE, f);
  assert.deepEqual(out, grants);
  assert.equal(f.calls[0].url, `${BASE}/api/v1/permissions/public`);
  assert.equal(f.calls[0].init.headers?.authorization, undefined);
});

test("PERM-22: fetchPermissionsPublic throws on upstream failure", async () => {
  const f = makeFetch([jsonResponse(500, {})]);
  await assert.rejects(() => fetchPermissionsPublic(BASE, f));
});

test("refreshTokens returns a new pair on success and null on failure", async () => {
  const ok = makeFetch([jsonResponse(200, { accessToken: "a2", refreshToken: "r2" })]);
  assert.deepEqual(await refreshTokens(BASE, ok, "r1"), { accessToken: "a2", refreshToken: "r2" });

  const bad = makeFetch([jsonResponse(401, {})]);
  assert.equal(await refreshTokens(BASE, bad, "r1"), null);
});

test("refreshTokensSingleFlight coalesces concurrent refresh calls for the same token", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    // Slow enough that both concurrent callers will see the in-flight promise.
    await new Promise((resolve) => setTimeout(resolve, 20));
    return jsonResponse(200, { accessToken: "a2", refreshToken: "r2" });
  };

  const [first, second] = await Promise.all([
    refreshTokensSingleFlight(BASE, fetchImpl, "shared-refresh-token"),
    refreshTokensSingleFlight(BASE, fetchImpl, "shared-refresh-token"),
  ]);

  assert.equal(calls, 1, "only one upstream /auth/refresh request should be made");
  assert.deepEqual(first, { accessToken: "a2", refreshToken: "r2" });
  assert.deepEqual(second, { accessToken: "a2", refreshToken: "r2" });
});

test("fetchPermissionsMe returns permissions on the happy path", async () => {
  const me = { roles: [], isAdministrator: true, functions: [1, 2], mapLayers: [3], gdbItems: [] };
  const f = makeFetch([jsonResponse(200, me)]);
  const out = await fetchPermissionsMe(BASE, f, {
    accessToken: "a1",
    refreshToken: "r1",
    user: USER,
  });

  assert.equal(out.cleared, false);
  assert.equal(out.rotated, null);
  assert.deepEqual(out.me, me);
  assert.equal(f.calls[0].url, `${BASE}/api/v1/permissions/me`);
  assert.equal(f.calls[0].init.headers.authorization, "Bearer a1");
});

test("fetchPermissionsMe refreshes on 401 and retries with the rotated token", async () => {
  const me = { roles: [], isAdministrator: false, functions: [], mapLayers: [], gdbItems: [] };
  const f = makeFetch([
    jsonResponse(401, {}), // GET /permissions/me
    jsonResponse(200, { accessToken: "a2", refreshToken: "r2" }), // POST /auth/refresh
    jsonResponse(200, me), // retry GET /permissions/me
  ]);
  const out = await fetchPermissionsMe(BASE, f, {
    accessToken: "a1",
    refreshToken: "r1",
    user: USER,
  });

  assert.equal(out.cleared, false);
  assert.deepEqual(out.rotated, { accessToken: "a2", refreshToken: "r2" });
  assert.deepEqual(out.me, me);
  assert.equal(f.calls[1].url, `${BASE}/api/v1/auth/refresh`);
  assert.deepEqual(JSON.parse(f.calls[1].init.body), { refreshToken: "r1" });
  assert.equal(f.calls[2].init.headers.authorization, "Bearer a2");
});

test("fetchPermissionsMe clears the session when the refresh fails", async () => {
  const f = makeFetch([
    jsonResponse(401, {}), // GET /permissions/me
    jsonResponse(401, {}), // POST /auth/refresh fails
  ]);
  const out = await fetchPermissionsMe(BASE, f, {
    accessToken: "a1",
    refreshToken: "r1",
    user: USER,
  });
  assert.deepEqual(out, { me: null, rotated: null, cleared: true });
});

test("fetchPermissionsMe clears the session when the retry still 401s", async () => {
  const f = makeFetch([
    jsonResponse(401, {}), // GET /permissions/me
    jsonResponse(200, { accessToken: "a2", refreshToken: "r2" }), // refresh ok
    jsonResponse(401, {}), // retry still unauthorized
  ]);
  const out = await fetchPermissionsMe(BASE, f, {
    accessToken: "a1",
    refreshToken: "r1",
    user: USER,
  });
  assert.equal(out.cleared, true);
  assert.equal(out.me, null);
});

test("logoutRemote calls POST /auth/logout with the Bearer token", async () => {
  const f = makeFetch([jsonResponse(204, {})]);
  await logoutRemote(BASE, f, "acc");
  assert.equal(f.calls[0].url, `${BASE}/api/v1/auth/logout`);
  assert.equal(f.calls[0].init.method, "POST");
  assert.equal(f.calls[0].init.headers.authorization, "Bearer acc");
});

test("rememberStartNationalId / takeStartNationalId round-trips once", () => {
  rememberStartNationalId("sref", "1234567890");
  assert.equal(takeStartNationalId("sref"), "1234567890");
  // Single-use: the second read is empty.
  assert.equal(takeStartNationalId("sref"), null);
  assert.equal(takeStartNationalId("never-set"), null);
});
