/**
 * Attachments on a request row (SDI.Transaction), read server-side.
 *
 * SERVER ONLY — it uses `ARCGIS_SERVER_TOKEN`, and the caller's right to see a request's
 * files is checked here rather than in the browser.
 *
 * ⚠️ This service does NOT support the `queryAttachments` operation. Verified live
 * 2026-09-28: a POST to `/5/queryAttachments` returns the LAYER METADATA, not attachments —
 * the op simply is not implemented on 10.61, and the layer resource advertises no
 * `supportsQueryAttachments`. The per-feature endpoint `/5/{objectId}/attachments` does work
 * and is what this module uses. Anything built on `FeatureLayer.queryAttachments()` here is
 * relying on an operation the server never implemented.
 */

import { REGULATION_LAYERS } from "@/lib/arcgis";
import { REGULATION_SERVICE_URL } from "@/server/arcgis";

const SERVICE_URL = REGULATION_SERVICE_URL;

const REQUESTS_LAYER_URL = `${SERVICE_URL}/${REGULATION_LAYERS.TRANSACTIONS_TABLE}`;

/** One attachment as the service describes it. The service returns NO date for an
 *  attachment, so there is nothing to show for "uploaded at" — do not invent one. */
export type RequestAttachment = {
  id: number;
  name: string;
  contentType: string;
  /** Bytes. */
  size: number;
};

function requireToken(): string {
  const token = process.env.ARCGIS_SERVER_TOKEN;
  if (!token) {
    throw new Error("ARCGIS_SERVER_TOKEN غير موجود — لا يمكن قراءة مرفقات الطلب.");
  }
  return token;
}

/** The office (USER_ID) a request belongs to — the basis of the access check. */
export async function getRequestOwner(objectId: number): Promise<string | null> {
  const token = requireToken();

  const body = new URLSearchParams({
    f: "json",
    token,
    where: `OBJECTID = ${Number(objectId)}`,
    outFields: "OBJECTID,USER_ID",
    returnGeometry: "false",
  });

  const response = await fetch(`${REQUESTS_LAYER_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`تعذّر قراءة بيانات الطلب (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    features?: Array<{ attributes?: { USER_ID?: string | null } }>;
  };

  if (payload.error) throw new Error(payload.error.message ?? "تعذّر قراءة بيانات الطلب.");

  const features = payload.features ?? [];
  if (features.length === 0) return null;

  const owner = features[0]?.attributes?.USER_ID;
  return typeof owner === "string" && owner.trim() ? owner.trim() : null;
}

/** Every attachment on a request, in the order the service lists them. */
export async function listRequestAttachments(objectId: number): Promise<RequestAttachment[]> {
  const token = requireToken();

  const url = `${REQUESTS_LAYER_URL}/${Number(objectId)}/attachments?f=json&token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`تعذّر قراءة مرفقات الطلب (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    attachmentInfos?: Array<{
      id?: number;
      name?: string;
      contentType?: string;
      size?: number;
    }>;
  };

  if (payload.error) throw new Error(payload.error.message ?? "تعذّر قراءة مرفقات الطلب.");

  return (payload.attachmentInfos ?? []).flatMap((info) => {
    if (typeof info.id !== "number") return [];
    return [
      {
        id: info.id,
        name: info.name?.trim() || `مرفق ${info.id}`,
        contentType: info.contentType?.trim() || "application/octet-stream",
        size: typeof info.size === "number" ? info.size : 0,
      },
    ];
  });
}

/** One attachment's bytes, for streaming back to the browser. */
export async function fetchRequestAttachment(
  objectId: number,
  attachmentId: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const token = requireToken();

  const url = `${REQUESTS_LAYER_URL}/${Number(objectId)}/attachments/${Number(attachmentId)}?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`تعذّر تحميل المرفق (HTTP ${response.status}).`);
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
