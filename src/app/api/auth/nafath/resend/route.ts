import { NextResponse } from "next/server";
import { isPermissionsApiConfigured, PERMISSIONS_API_URL, permissionsApi } from "@/server/nafath";
import { mockNafathClient } from "@/server/nafath/mock-client";
import { getPendingTx, updatePendingTx } from "@/server/nafath/store";

// Issue a new number for the same session. Thin proxy to the permissions-api
// when configured; otherwise the in-process dev mock.
export async function POST(req: Request) {
  let body: { sessionRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionRef = String(body.sessionRef ?? "");

  if (isPermissionsApiConfigured()) {
    try {
      const out = await permissionsApi.nafathResend(PERMISSIONS_API_URL, fetch, sessionRef);
      return NextResponse.json(out);
    } catch {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
  }

  // Dev mock fallback.
  const tx = getPendingTx(sessionRef);
  if (!tx) {
    return NextResponse.json({ error: "unknown_session" }, { status: 404 });
  }

  const init = await mockNafathClient.initiate(tx.nationalId, tx.locale);
  updatePendingTx(sessionRef, {
    transId: init.transId,
    random: init.random,
    createdAt: Date.now(),
  });
  return NextResponse.json({
    sessionRef,
    random: init.random,
    expiresInSec: init.expiresInSec,
  });
}
