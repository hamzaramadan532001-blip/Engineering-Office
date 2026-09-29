import { NextResponse } from "next/server";
import { isPermissionsApiConfigured, PERMISSIONS_API_URL, permissionsApi } from "@/server/nafath";
import { mockNafathClient } from "@/server/nafath/mock-client";
import { createPendingTx } from "@/server/nafath/store";

const NATIONAL_ID = /^[12]\d{9}$/;

// Begin a Nafath challenge. Thin proxy to the permissions-api when configured;
// otherwise the in-process dev mock (see docs/nafath-integration.md).
export async function POST(req: Request) {
  let body: {
    nationalId?: string;
    locale?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    officeName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const nationalId = String(body.nationalId ?? "").trim();
  const locale = body.locale === "en" ? "en" : "ar";
  if (!NATIONAL_ID.test(nationalId)) {
    return NextResponse.json({ error: "invalid_national_id" }, { status: 422 });
  }

  // Registration fields from the engineering-office signup form. Only used by
  // the dev-mock branch below to seed a signup request; the real
  // permissions-api call is untouched.
  const firstName = String(body.firstName ?? "").trim() || undefined;
  const lastName = String(body.lastName ?? "").trim() || undefined;
  const email = String(body.email ?? "").trim() || undefined;
  const officeName = String(body.officeName ?? "").trim() || undefined;

  if (isPermissionsApiConfigured()) {
    try {
      const out = await permissionsApi.nafathStart(PERMISSIONS_API_URL, fetch, {
        nationalId,
        locale,
      });
      permissionsApi.rememberStartNationalId(out.sessionRef, nationalId);
      return NextResponse.json(out);
    } catch {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
  }

  // Dev mock fallback (no permissions-api configured).
  const init = await mockNafathClient.initiate(nationalId, locale);
  const tx = createPendingTx({
    transId: init.transId,
    random: init.random,
    nationalId,
    locale,
    firstName,
    lastName,
    email,
    officeName,
  });
  return NextResponse.json({
    sessionRef: tx.sessionRef,
    random: init.random,
    expiresInSec: init.expiresInSec,
  });
}
