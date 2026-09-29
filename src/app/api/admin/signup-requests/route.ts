import { NextResponse } from "next/server";
import { listSignupRequests } from "@/server/signupRequests/store";

// Local/dev-only admin endpoint — see the note in `app/admin/page.tsx` about
// wiring real admin-role checks before this ever leaves a developer machine.
export async function GET() {
  return NextResponse.json({ requests: listSignupRequests() });
}
