import { NextResponse } from "next/server";
import {
  GUEST_SESSION_TTL_SEC,
  getSessionSecret,
  sealSession,
  SESSION_COOKIE,
} from "@/server/nafath";
import { findOfficeByNationalNumber } from "@/server/engineeringOffices";

/**
 * Login by الرقم الوطني against the register of qualified engineering offices.
 *
 * On a match it seals the SAME session cookie the Nafath flow seals — a PERM-22 style
 * guest session (identity, no permissions-api token pair) — so `src/proxy.ts` and every
 * existing gate keep working with no change. Nothing about the Nafath path is touched:
 * a number that is not in the register gets 404 and the login screen falls through to
 * Nafath exactly as before.
 *
 * ⚠️ SECURITY: this authenticates on a national number ALONE, with no second factor.
 * Those 116 numbers are readable from the FeatureServer, so anyone who can reach the
 * service can sign in as any office. That is acceptable only for a demo/pilot; before this
 * sees real data it needs Nafath (or any real credential) in front of it. Flagged in the
 * handover, not silently shipped.
 */
export async function POST(request: Request) {
  let nationalNumber = "";

  try {
    const body = (await request.json()) as { nationalNumber?: unknown };
    nationalNumber = typeof body.nationalNumber === "string" ? body.nationalNumber.trim() : "";
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  if (!nationalNumber) {
    return NextResponse.json({ error: "الرقم الوطني مطلوب." }, { status: 400 });
  }

  let office;
  try {
    office = await findOfficeByNationalNumber(nationalNumber);
  } catch (error) {
    // The register being unreachable is NOT "you are not registered" — say so, so nobody
    // is told they are unregistered because of an outage.
    console.error("[auth] engineering-office lookup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذّر التحقق من سجل المكاتب الهندسية." },
      { status: 502 },
    );
  }

  if (!office) {
    // 404 is the signal the login form uses to continue with Nafath.
    return NextResponse.json(
      { error: "هذا الرقم غير مسجل في سجل المكاتب الهندسية المؤهلة.", registered: false },
      { status: 404 },
    );
  }

  // Map the office onto the existing SessionUser shape rather than inventing a second
  // session format: `username` carries the national number, which is all that is needed to
  // re-read the office later (see GET /api/auth/office) — so no office data is duplicated
  // into the cookie where it could go stale.
  const sealed = await sealSession(
    {
      guest: true,
      user: {
        userId: office.objectId,
        username: office.nationalNumber,
        fullName: office.name,
        isAdministrator: false,
        roles: [],
      },
    },
    getSessionSecret(),
    GUEST_SESSION_TTL_SEC,
  );

  const response = NextResponse.json({ authenticated: true, office });

  response.cookies.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_SESSION_TTL_SEC,
  });

  return response;
}
