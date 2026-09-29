// Unit tests for the encrypted session cookie. Proves the JWT pair round-trips
// server-side and that tampered/foreign cookies decrypt to null.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { EncryptJWT } from "jose";
import { openSession, sealSession } from "./session.ts";

const SECRET = "test-secret-value";
const SESSION = {
  accessToken: "access-jwt",
  refreshToken: "refresh-jwt",
  user: {
    userId: 7,
    username: "fadel.ghandour",
    fullName: "فاضل غندور",
    isAdministrator: true,
    roles: ["Administrator", "Public"],
  },
};

const GUEST_USER = {
  userId: 0,
  username: "guest",
  fullName: "زائر كريم",
  isAdministrator: false,
  roles: [],
};

/** Seal an arbitrary payload the same way session.ts does — for crafting invalid shapes. */
async function sealRaw(payload, secret, ttlSec) {
  const key = new Uint8Array(createHash("sha256").update(secret).digest());
  return await new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .encrypt(key);
}

test("sealSession → openSession round-trips the token pair and user", async () => {
  const cookie = await sealSession(SESSION, SECRET, 3600);
  assert.equal(typeof cookie, "string");
  // The sealed value is a compact JWE — the tokens must not be readable in it.
  assert.ok(!cookie.includes("access-jwt"));
  assert.ok(!cookie.includes("refresh-jwt"));

  const opened = await openSession(cookie, SECRET);
  assert.deepEqual(opened, SESSION);
});

test("openSession returns null for a garbage cookie", async () => {
  assert.equal(await openSession("not-a-jwe", SECRET), null);
});

test("openSession returns null when decrypted with the wrong secret", async () => {
  const cookie = await sealSession(SESSION, SECRET, 3600);
  assert.equal(await openSession(cookie, "a-different-secret"), null);
});

test("openSession returns null for an expired cookie", async () => {
  const cookie = await sealSession(SESSION, SECRET, -1);
  assert.equal(await openSession(cookie, SECRET), null);
});

test("PERM-22: guest sealSession → openSession round-trips with no token pair in the payload", async () => {
  const cookie = await sealSession({ guest: true, user: GUEST_USER }, SECRET, 3600);
  const opened = await openSession(cookie, SECRET);
  assert.deepEqual(opened, { guest: true, user: GUEST_USER });
});

test("PERM-22: sealSession drops tokens from a guest session even if the caller passes them", async () => {
  const cookie = await sealSession(
    { guest: true, user: GUEST_USER, accessToken: "leak", refreshToken: "leak" },
    SECRET,
    3600,
  );
  const opened = await openSession(cookie, SECRET);
  assert.deepEqual(opened, { guest: true, user: GUEST_USER });
});

test("PERM-22: openSession rejects a guest payload that smuggles a token pair", async () => {
  const cookie = await sealRaw(
    { guest: true, user: GUEST_USER, accessToken: "smuggled", refreshToken: "smuggled" },
    SECRET,
    3600,
  );
  assert.equal(await openSession(cookie, SECRET), null);
});

test("PERM-22: openSession rejects a guest payload with a malformed user", async () => {
  const cookie = await sealRaw({ guest: true, user: { username: "guest" } }, SECRET, 3600);
  assert.equal(await openSession(cookie, SECRET), null);
});
