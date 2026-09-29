import { type NextRequest, NextResponse } from "next/server";
import { canAccessRequest } from "@/server/requestAccess";
import { listRequestAttachments } from "@/server/requestAttachments";

/**
 * Every attachment on one request — what the "عرض PDF" table lists.
 *
 * Server-side because the file list is only readable with the server token, and because who
 * may see it depends on the session (see requestAccess.ts).
 *
 * Next 16: dynamic route params are async.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const objectId = Number(id);

  const access = await canAccessRequest(objectId, request.cookies);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    return NextResponse.json({ attachments: await listRequestAttachments(objectId) });
  } catch (error) {
    console.error("[requests] failed to list attachments:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذّر قراءة مرفقات الطلب." },
      { status: 502 },
    );
  }
}
