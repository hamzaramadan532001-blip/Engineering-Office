import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { readAdminSession } from "@/server/adminSession";
import { findEmployeeByIdentityNo } from "@/server/employees";

/**
 * The employee (and therefore the DEPT_ID) behind the current admin session.
 *
 * Re-reads SDI.EMPLOYEES rather than returning a copy sealed at login, so a department
 * transfer takes effect immediately instead of being stale until the cookie expires.
 *
 * 401 when there is no admin session. 200 with `employee: null` when the session is a LEGACY
 * email/password one — that is a valid admin with no employee record, so it has no
 * department, and the caller needs to tell those two cases apart.
 */
export async function GET(request: NextRequest) {
  const session = await readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (!session.identityNo) {
    return NextResponse.json({ authenticated: true, employee: null });
  }

  try {
    const employee = await findEmployeeByIdentityNo(session.identityNo);
    return NextResponse.json({ authenticated: true, employee: employee ?? null });
  } catch (error) {
    console.error("[admin] failed to re-read the employee for this session:", error);
    return NextResponse.json({ error: "تعذّر قراءة بيانات الموظف." }, { status: 502 });
  }
}
