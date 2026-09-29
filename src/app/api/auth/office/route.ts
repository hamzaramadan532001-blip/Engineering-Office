import { type NextRequest, NextResponse } from "next/server";
import { getSessionSecret, openSession, SESSION_COOKIE } from "@/server/nafath";
import { findOfficeByNationalNumber } from "@/server/engineeringOffices";

/**
 * The office the current session belongs to — "the data we will need shortly".
 *
 * Deliberately re-reads the register instead of returning a copy stored in the cookie.
 * The cookie holds only the national number, so the office's licence grades, email and
 * contact number are always whatever the service says NOW; an administrator editing the
 * register does not leave stale values sealed in someone's session for the next four hours.
 *
 * 401 when there is no office session — including a Nafath session, whose `username` is a
 * personal national id and so matches no office. Callers treat that as "not an office
 * login", not as an error.
 */
export async function GET(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let session;
  try {
    session = await openSession(raw, getSessionSecret());
  } catch (error) {
    // A cookie from the dev-mock path is an opaque UUID, not a JWE — it simply is not an
    // office session. Log at debug level: this is an expected shape, not a fault.
    console.debug("[auth] session cookie is not an office session:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const office = await findOfficeByNationalNumber(session.user.username);

    if (!office) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, office });
  } catch (error) {
    console.error("[auth] failed to re-read the office for this session:", error);
    return NextResponse.json(
      { error: "تعذّر قراءة بيانات المكتب الهندسي." },
      { status: 502 },
    );
  }
}
