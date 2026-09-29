import { type NextRequest, NextResponse } from "next/server";
import { canAccessRequest } from "@/server/requestAccess";
import { fetchRequestAttachment } from "@/server/requestAttachments";

/**
 * Streams one attachment back to the browser.
 *
 * Proxied rather than handing the browser the service URL directly: that URL would have to
 * carry the server token, which must never leave the server. The same access check as the
 * listing applies, so a valid attachment id is no use without a session entitled to it.
 *
 * `inline` so a PDF renders in the preview frame instead of downloading.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await params;
  const objectId = Number(id);
  const attachment = Number(attachmentId);

  if (!Number.isInteger(attachment) || attachment <= 0) {
    return NextResponse.json({ error: "مرفق غير صالح." }, { status: 400 });
  }

  const access = await canAccessRequest(objectId, request.cookies);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const { body, contentType } = await fetchRequestAttachment(objectId, attachment);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        // Attachments are immutable once uploaded, but the access check must run every
        // time — so no shared caching.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[requests] failed to fetch the attachment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذّر تحميل المرفق." },
      { status: 502 },
    );
  }
}
