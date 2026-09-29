import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { openSession, resolveSessionSecret, sealSession } from "./index.ts";

// Generated per run: nothing secret-shaped is committed, and each run proves the
// round-trip against a fresh key rather than one baked into the file.
const SECRET = randomBytes(32).toString("hex");
const DEV_DEFAULT = randomBytes(8).toString("hex");

const isPayload = (v) => typeof v === "object" && v !== null && typeof v.accessToken === "string";

test("seal → open round-trips the payload", async () => {
  const sealed = await sealSession({ accessToken: "a", refreshToken: "r" }, SECRET, 60);
  const opened = await openSession(sealed, SECRET, isPayload);
  assert.equal(opened.accessToken, "a");
  assert.equal(opened.refreshToken, "r");
});

test("the cookie value is opaque — no plaintext token leaks into it", async () => {
  const sealed = await sealSession({ accessToken: "super-secret-jwt" }, SECRET, 60);
  assert.ok(!sealed.includes("super-secret-jwt"));
});

test("a wrong secret opens nothing", async () => {
  const sealed = await sealSession({ accessToken: "a" }, SECRET, 60);
  assert.equal(await openSession(sealed, `${SECRET}-different`, isPayload), null);
});

test("a tampered cookie opens nothing", async () => {
  const sealed = await sealSession({ accessToken: "a" }, SECRET, 60);
  const tampered = `${sealed.slice(0, -3)}xyz`;
  assert.equal(await openSession(tampered, SECRET, isPayload), null);
});

test("an expired cookie opens nothing", async () => {
  const sealed = await sealSession({ accessToken: "a" }, SECRET, -1);
  assert.equal(await openSession(sealed, SECRET, isPayload), null);
});

test("a payload the guard rejects opens nothing", async () => {
  const sealed = await sealSession({ somethingElse: true }, SECRET, 60);
  assert.equal(await openSession(sealed, SECRET, isPayload), null);
});

test("garbage opens nothing rather than throwing", async () => {
  assert.equal(await openSession("not-a-jwe", SECRET, isPayload), null);
});

test("resolveSessionSecret falls back to the dev default with no upstream", () => {
  const got = resolveSessionSecret({
    upstreamUrl: "",
    sessionSecret: undefined,
    devDefault: DEV_DEFAULT,
  });
  assert.equal(got, DEV_DEFAULT);
});

test("resolveSessionSecret refuses a missing secret once an upstream is set", () => {
  assert.throws(() =>
    resolveSessionSecret({
      upstreamUrl: "http://api.local",
      sessionSecret: undefined,
      devDefault: DEV_DEFAULT,
    }),
  );
});

test("resolveSessionSecret refuses the dev default once an upstream is set", () => {
  assert.throws(() =>
    resolveSessionSecret({
      upstreamUrl: "http://api.local",
      sessionSecret: DEV_DEFAULT,
      devDefault: DEV_DEFAULT,
    }),
  );
});

test("resolveSessionSecret refuses a too-short secret once an upstream is set", () => {
  assert.throws(() =>
    resolveSessionSecret({
      upstreamUrl: "http://api.local",
      sessionSecret: "too-short",
      devDefault: DEV_DEFAULT,
    }),
  );
});
