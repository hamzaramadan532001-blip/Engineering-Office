import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GUEST_SESSION_TTL_SEC,
  getSessionSecret,
  isPermissionsApiConfigured,
  PERMISSIONS_API_URL,
  permissionsApi,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  sealSession,
} from "@/server/nafath";
import { mockNafathClient } from "@/server/nafath/mock-client";
import { deletePendingTx, getPendingTx, updatePendingTx } from "@/server/nafath/store";
import { createSignupRequest, getSignupRequest } from "@/server/signupRequests/store";

// Poll a Nafath challenge. On COMPLETED the permissions-api returns the JWT pair
// + resolved user; those are sealed into the httpOnly session cookie and never
// echoed to the browser (which only ever sees {status, user:{nationalId, fullNameAr}}).
export async function GET(req: Request) {
  const sessionRef = new URL(req.url).searchParams.get("sessionRef") ?? "";

  if (isPermissionsApiConfigured()) {
    let result: Awaited<ReturnType<typeof permissionsApi.nafathStatus>>;
    try {
      result = await permissionsApi.nafathStatus(PERMISSIONS_API_URL, fetch, sessionRef);
    } catch {
      // Deliberately HTTP 200 with {status:"ERROR"}: the frozen browser client
      // (src/app/login/nafath.ts) maps any status other than
      // WAITING/COMPLETED/EXPIRED to "rejected", which is the UX we want for an
      // upstream outage mid-poll.
      return NextResponse.json({ status: "ERROR" });
    }

    // PERM-22: Nafath-verified but not in SDIUSERS — seal a guest cookie (no
    // tokens) and tell the frozen browser client COMPLETED (it maps any unknown
    // status to "rejected"; guest-ness lives server-side in the cookie).
    if (result.status === "GUEST") {
      const nationalId = permissionsApi.takeStartNationalId(sessionRef);
      const sealed = await sealSession(
        { guest: true, user: result.user },
        getSessionSecret(),
        GUEST_SESSION_TTL_SEC,
      );
      const res = NextResponse.json(permissionsApi.toBrowserStatus(result, nationalId));
      res.cookies.set(SESSION_COOKIE, sealed, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: GUEST_SESSION_TTL_SEC,
      });
      return res;
    }

    if (result.status !== "COMPLETED") {
      return NextResponse.json({ status: result.status });
    }

    const nationalId = permissionsApi.takeStartNationalId(sessionRef);
    // getSessionSecret throws with a clear message when SESSION_SECRET is
    // missing/weak in real-API mode — better a loud 500 on first login than
    // sealing real JWTs with the committed dev default.
    const sealed = await sealSession(
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
      getSessionSecret(),
      SESSION_TTL_SEC,
    );
    const res = NextResponse.json(permissionsApi.toBrowserStatus(result, nationalId));
    res.cookies.set(SESSION_COOKIE, sealed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    });
    return res;
  }

  // Dev mock fallback: opaque session cookie on approval (no real tokens exist).
  const tx = getPendingTx(sessionRef);
  if (!tx) {
    return NextResponse.json({ status: "EXPIRED" });
  }

  const result = await mockNafathClient.getStatus({
    transId: tx.transId,
    random: tx.random,
    nationalId: tx.nationalId,
  });

  if (result.status !== "COMPLETED") {
    return NextResponse.json({ status: result.status });
  }

  const nationalId = result.user?.nationalId ?? tx.nationalId;

  // Plain login (LoginForm — national ID only, no registration profile on
  // this tx): behave exactly like before the signup-request feature existed
  // and log straight in. Only a tx started from the "إضافة مستخدم جديد"
  // signup form (SignupForm, which always sends firstName) goes through the
  // approval gate below.
  if (!tx.firstName) {
    deletePendingTx(sessionRef);
    const res = NextResponse.json({
      status: "COMPLETED",
      user: {
        nationalId,
        fullNameAr: result.user?.fullNameAr ?? null,
      },
    });
    res.cookies.set(SESSION_COOKIE, randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    });
    return res;
  }

  // Local approval gate (dev-mock only — the real flow's PERM-22 GUEST branch
  // above is where this happens against the actual permissions-api/SDIUSERS).
  // First-time signups land as "pending" until an admin decides them on
  // /admin; a national ID with an existing approved request skips straight
  // through on every later login via SignupForm. The pending tx is
  // deliberately kept alive (not deleted) while pending, so the browser can
  // keep polling this same sessionRef and pick up an admin's decision
  // without restarting Nafath.
  //
  // The signup request is created/looked-up ONCE per sessionRef and its id
  // pinned onto the tx — every later poll re-fetches that exact request by
  // id instead of calling createSignupRequest() again. Otherwise, once an
  // admin rejects it, the very next poll would see a "rejected" record and
  // (per createSignupRequest's resubmission rule) spin up a brand-new
  // "pending" one, silently flipping a rejection back to "waiting" forever.
  let signupRequest = tx.signupRequestId ? getSignupRequest(tx.signupRequestId) : undefined;
  if (!signupRequest) {
    signupRequest = createSignupRequest({
      nationalId,
      firstName: tx.firstName ?? "",
      lastName: tx.lastName ?? "",
      email: tx.email ?? "",
      officeName: tx.officeName ?? "",
    });
    updatePendingTx(sessionRef, { signupRequestId: signupRequest.id });
  }

  if (signupRequest.status === "pending") {
    return NextResponse.json({ status: "PENDING_APPROVAL" });
  }

  if (signupRequest.status === "rejected") {
    deletePendingTx(sessionRef);
    return NextResponse.json({ status: "SIGNUP_REJECTED" });
  }

  deletePendingTx(sessionRef);
  const res = NextResponse.json({
    status: "COMPLETED",
    user: {
      nationalId,
      fullNameAr: result.user?.fullNameAr ?? null,
    },
  });
  res.cookies.set(SESSION_COOKIE, randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return res;
}
