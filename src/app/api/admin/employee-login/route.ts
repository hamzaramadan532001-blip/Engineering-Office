import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { ADMIN_SESSION_TTL_SEC, sealAdminSession } from "@/server/adminSession";
import { findEmployeeByIdentityNo } from "@/server/employees";

/**
 * Admin login by ID / residency number, against SDI.EMPLOYEES (layer 6).
 *
 * Mirrors the engineering-office login: a number that exists signs in and returns the
 * person's name plus their DEPT_ID; a number that does not is refused with 404, which the
 * form renders as "ليس لديك صلاحية الدخول".
 *
 * ⚠️ SECURITY: like the office login, this authenticates on a number ALONE with no second
 * factor — and these are staff ID numbers. Acceptable for a demo; before real use it needs a
 * real credential (Nafath, AD/SSO — note the table even carries an `AD` username column)
 * in front of it. Flagged, not silently shipped.
 */
export async function POST(request: Request) {
  let identityNo = "";

  try {
    const body = (await request.json()) as { identityNo?: unknown };
    identityNo = typeof body.identityNo === "string" ? body.identityNo.trim() : "";
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  if (!identityNo) {
    return NextResponse.json({ error: "رقم الهوية مطلوب." }, { status: 400 });
  }

  let employee;
  try {
    employee = await findEmployeeByIdentityNo(identityNo);
  } catch (error) {
    // An unreachable service is NOT "you have no access" — never refuse someone because of
    // an outage.
    console.error("[admin] employee lookup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذّر التحقق من بيانات الموظفين." },
      { status: 502 },
    );
  }

  if (!employee) {
    return NextResponse.json({ error: "ليس لديك صلاحية الدخول", registered: false }, { status: 404 });
  }

  const sealed = await sealAdminSession(employee.identityNo, employee.fullName);

  const response = NextResponse.json({ authenticated: true, employee });

  response.cookies.set(ADMIN_SESSION_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SEC,
  });

  return response;
}
