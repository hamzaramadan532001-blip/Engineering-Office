import { NextResponse } from "next/server";
import {
  addSignupRequestNote,
  decideSignupRequest,
  getSignupRequest,
} from "@/server/signupRequests/store";

const DECISIONS = new Set(["approved", "rejected"]);

// Next 16: dynamic route params are async.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { status?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!getSignupRequest(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A request can either carry a status decision or a note reply.
  if (typeof body.note === "string") {
    const note = body.note.trim();
    if (!note) {
      return NextResponse.json({ error: "invalid_note" }, { status: 422 });
    }
    const updated = addSignupRequestNote(id, note);
    return NextResponse.json({ request: updated });
  }

  const status = body.status;
  if (!status || !DECISIONS.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 422 });
  }

  const updated = decideSignupRequest(id, status as "approved" | "rejected");
  return NextResponse.json({ request: updated });
}