/**
 * Turns an ArcGIS JS API error into something a user can act on.
 *
 * Why this exists: every failure here used to collapse into one sentence ("تعذّر تحميل
 * الطلبات من الخادم."), which hides the only thing that matters — WHICH failure it was.
 * The three that actually happen on this deployment need completely different responses,
 * and none of them is a bug in the app:
 *
 *   498 Invalid Token  → the browser token in the env file has expired; it must be renewed.
 *   499 Token Required → no token reached the service at all (registration did not run).
 *   500                → the service itself is erroring; only a GIS admin can restart it.
 *
 * Telling them apart in the UI is the difference between "someone renews a token in five
 * minutes" and "an afternoon spent debugging the wrong layer".
 *
 * No React: error in, message out.
 */

/** The shape the JS API's `request:server` / `request:` errors actually arrive in. */
type ArcgisErrorLike = {
  name?: string;
  message?: string;
  details?: {
    httpStatus?: number;
    messageCode?: string;
    messages?: string[];
    url?: string;
    // The service's own `{"error":{...}}` payload, when one came back.
    raw?: { error?: { code?: number; message?: string; details?: string[] } };
  };
};

/** Arabic explanation for the ArcGIS/HTTP status codes this service returns. */
function explainCode(code: number | undefined): string | null {
  switch (code) {
    case 498:
      return "انتهت صلاحية رمز الدخول (Token) الخاص بالخدمة — يجب تحديثه.";
    case 499:
      return "لم يتم إرسال رمز دخول (Token) إلى الخدمة.";
    case 403:
      return "لا توجد صلاحية للوصول إلى هذه الخدمة.";
    case 404:
      return "الخدمة أو الطبقة غير موجودة على الخادم.";
    case 500:
      return "الخدمة نفسها تُرجع خطأ (500) على الخادم — الرجاء مراجعة مسؤول نظم المعلومات الجغرافية.";
    default:
      return null;
  }
}

/** Digs the service's own error code out of whichever field the JS API put it in. */
function extractCode(error: ArcgisErrorLike): number | undefined {
  return error.details?.raw?.error?.code ?? error.details?.httpStatus;
}

/**
 * A single line naming the real cause, with the service's own text appended when it sent
 * any. `fallback` is used only when the error carries nothing identifiable at all.
 */
export function getArcgisErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;

  const arcgisError = error as ArcgisErrorLike;

  const code = extractCode(arcgisError);
  const explanation = explainCode(code);

  const serviceText =
    arcgisError.details?.raw?.error?.message ||
    (arcgisError.details?.messages?.length ? arcgisError.details.messages.join(" - ") : "") ||
    // The JS API frequently sets `message` to the literal string "Error", which tells the
    // reader nothing — treat that as absent rather than showing it.
    (arcgisError.message && arcgisError.message !== "Error" ? arcgisError.message : "");

  const parts = [
    explanation,
    serviceText,
    code !== undefined ? `(رمز الخطأ: ${code})` : "",
  ].filter(Boolean);

  if (parts.length === 0) {
    // An `Error` instance with a real message is still better than the fallback.
    if (error instanceof Error && error.message && error.message !== "Error") {
      return error.message;
    }
    return fallback;
  }

  return parts.join(" ");
}
