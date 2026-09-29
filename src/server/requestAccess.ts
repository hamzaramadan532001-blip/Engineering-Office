/**
 * May the current session see this request's attachments?
 *
 * Two kinds of caller are allowed, and the check is done SERVER-SIDE because the answer
 * depends on who the session belongs to, not on anything the browser sends:
 *
 *  - the engineering office that raised the request (its viewer session's national number
 *    must equal the request's USER_ID);
 *  - a municipality employee signed into /admin (any department — a reviewer has to be able
 *    to open the documents attached to what they are deciding on).
 *
 * Without this, any signed-in office could read another office's files by guessing an id.
 */

import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { readAdminSession } from "@/server/adminSession";
import { getSessionSecret, openSession, SESSION_COOKIE } from "@/server/nafath";
import { getRequestOwner } from "@/server/requestAttachments";

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 404; message: string };

/** The office national number sealed into the viewer session, if it is an office session. */
async function officeNumberFromSession(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  try {
    const session = await openSession(raw, getSessionSecret());
    const username = session?.user?.username?.trim();
    return username || null;
  } catch {
    // Not a sealed session (e.g. the dev-mock opaque UUID) — no office identity in it.
    return null;
  }
}

export async function canAccessRequest(
  objectId: number,
  cookies: { get(name: string): { value: string } | undefined },
): Promise<AccessDecision> {
  if (!Number.isInteger(objectId) || objectId <= 0) {
    return { allowed: false, status: 404, message: "طلب غير موجود." };
  }

  // An admin session is enough on its own — reviewers open files across offices.
  const adminSession = await readAdminSession(cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (adminSession) return { allowed: true };

  const officeNumber = await officeNumberFromSession(cookies.get(SESSION_COOKIE)?.value);
  if (!officeNumber) {
    return { allowed: false, status: 401, message: "الجلسة غير صالحة — الرجاء تسجيل الدخول." };
  }

  const owner = await getRequestOwner(objectId);
  if (owner === null) {
    return { allowed: false, status: 404, message: "طلب غير موجود." };
  }

  if (owner !== officeNumber) {
    return { allowed: false, status: 403, message: "هذا الطلب لا يخص مكتبك." };
  }

  return { allowed: true };
}
