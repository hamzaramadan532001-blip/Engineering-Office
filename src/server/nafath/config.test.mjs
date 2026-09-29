// Unit tests for session-cookie config policy. Run with `pnpm --filter gis-viewer test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePermissionsMode, resolveSessionSecret } from "./config.ts";

const DEV_DEFAULT = "dev-insecure-session-secret-change-me-in-prod";
const LONG_SECRET = "a".repeat(32);

test("mock mode falls back to the committed dev secret when SESSION_SECRET is unset", () => {
  assert.equal(
    resolveSessionSecret({ permissionsApiUrl: "", sessionSecret: undefined }),
    DEV_DEFAULT,
  );
});

test("mock mode uses the provided secret when set", () => {
  assert.equal(resolveSessionSecret({ permissionsApiUrl: "", sessionSecret: "custom" }), "custom");
});

test("real-API mode throws when SESSION_SECRET is missing", () => {
  assert.throws(
    () =>
      resolveSessionSecret({
        permissionsApiUrl: "http://localhost:3001",
        sessionSecret: undefined,
      }),
    /SESSION_SECRET is required when PERMISSIONS_API_URL is set/,
  );
});

test("real-API mode throws when SESSION_SECRET is the committed dev default", () => {
  assert.throws(
    () =>
      resolveSessionSecret({
        permissionsApiUrl: "http://localhost:3001",
        sessionSecret: DEV_DEFAULT,
      }),
    /SESSION_SECRET must not be the committed dev default/,
  );
});

test("real-API mode throws when SESSION_SECRET is too short", () => {
  assert.throws(
    () =>
      resolveSessionSecret({ permissionsApiUrl: "http://localhost:3001", sessionSecret: "short" }),
    /SESSION_SECRET is too short/,
  );
});

test("real-API mode accepts a secret of exactly 32 bytes", () => {
  assert.equal(
    resolveSessionSecret({
      permissionsApiUrl: "http://localhost:3001",
      sessionSecret: LONG_SECRET,
    }),
    LONG_SECRET,
  );
});

test("real-API mode trims whitespace before validating length", () => {
  assert.throws(
    () =>
      resolveSessionSecret({
        permissionsApiUrl: "http://localhost:3001",
        sessionSecret: `  ${"x".repeat(30)}  `,
      }),
    /SESSION_SECRET is too short/,
  );
});

// PERM-21: the no-grants mock switches widget/layer gating OFF, so production
// must refuse to serve it rather than show every widget and layer to everyone.
test("permissions mode is real whenever PERMISSIONS_API_URL is set", () => {
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    assert.equal(
      resolvePermissionsMode({
        permissionsApiUrl: "http://localhost:3001",
        nodeEnv,
        enforcement: undefined,
      }),
      "real",
    );
  }
});

test("production without PERMISSIONS_API_URL throws instead of serving ungated permissions", () => {
  assert.throws(
    () =>
      resolvePermissionsMode({
        permissionsApiUrl: "",
        nodeEnv: "production",
        enforcement: undefined,
      }),
    /PERMISSIONS_API_URL is required in production/,
  );
});

test("production rejects a whitespace-only PERMISSIONS_API_URL", () => {
  assert.throws(
    () =>
      resolvePermissionsMode({
        permissionsApiUrl: "   ",
        nodeEnv: "production",
        enforcement: undefined,
      }),
    /PERMISSIONS_API_URL is required in production/,
  );
});

test("non-production without PERMISSIONS_API_URL still uses the mock — local dev unaffected", () => {
  for (const nodeEnv of ["development", "test", undefined]) {
    assert.equal(
      resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv, enforcement: undefined }),
      "mock",
    );
  }
});

// PERM-21b: shipping the viewer before the permissions-api exists is a real rollout
// need — but ONLY an explicit PERMISSIONS_ENFORCEMENT=off may switch gating off.
test("an explicit PERMISSIONS_ENFORCEMENT=off runs unenforced, in production too", () => {
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    assert.equal(
      resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv, enforcement: "off" }),
      "unenforced",
    );
  }
});

test("PERMISSIONS_ENFORCEMENT=off wins over a configured PERMISSIONS_API_URL", () => {
  assert.equal(
    resolvePermissionsMode({
      permissionsApiUrl: "http://localhost:3001",
      nodeEnv: "production",
      enforcement: "off",
    }),
    "unenforced",
  );
});

test("the off switch is read case- and whitespace-insensitively", () => {
  for (const enforcement of [" off ", "OFF", "Off"]) {
    assert.equal(
      resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv: "production", enforcement }),
      "unenforced",
    );
  }
});

test("PERMISSIONS_ENFORCEMENT=on is the default and changes nothing", () => {
  assert.equal(
    resolvePermissionsMode({
      permissionsApiUrl: "http://localhost:3001",
      nodeEnv: "production",
      enforcement: "on",
    }),
    "real",
  );
  assert.throws(
    () =>
      resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv: "production", enforcement: "on" }),
    /PERMISSIONS_API_URL is required in production/,
  );
});

test("an empty PERMISSIONS_ENFORCEMENT is absence, not off", () => {
  assert.throws(
    () =>
      resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv: "production", enforcement: "  " }),
    /PERMISSIONS_API_URL is required in production/,
  );
});

test("a value that is neither on nor off throws instead of being read as off", () => {
  for (const enforcement of ["false", "0", "disabled", "no"]) {
    assert.throws(
      () => resolvePermissionsMode({ permissionsApiUrl: "", nodeEnv: "production", enforcement }),
      /PERMISSIONS_ENFORCEMENT must be "on" or "off"/,
    );
  }
});
