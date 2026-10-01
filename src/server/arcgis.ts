/**
 * Server-side access to the secured Regulation571EditTrans FeatureServer (queried with
 * `ARCGIS_SERVER_TOKEN`). SERVER ONLY.
 */

const DEFAULT_REGULATION_SERVICE_URL =
  "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/Regulation571EditTrans/FeatureServer";

/** `||`, not `??`: an empty `ARCGIS_REGULATION_TRANSACTIONS_URL=` line in the env file
 *  must fall back to the default, not produce a relative "/8/query" URL. */
export const REGULATION_SERVICE_URL = (
  process.env.ARCGIS_REGULATION_TRANSACTIONS_URL || DEFAULT_REGULATION_SERVICE_URL
).replace(/\/+$/, "");

/** Longer than any healthy query, shorter than the reverse proxy's own timeout, so the
 *  user gets our message instead of a bare gateway error. */
const TIMEOUT_MS = 20_000;

/**
 * `fetch` that turns a network-level failure into a message naming the real cause.
 * Node reports every such failure as a bare "fetch failed" with the reason hidden in
 * `error.cause` — on a server that is the difference between "DNS", "firewall" and
 * "certificate not trusted", which need completely different fixes.
 */
export async function arcgisServerFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const host = safeHost(url);
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    const code = cause?.code ?? (error as { name?: string }).name;
    const reason =
      code === "TimeoutError"
        ? `انتهت مهلة الاتصال (${TIMEOUT_MS / 1000} ثانية)`
        : code === "ENOTFOUND" || code === "EAI_AGAIN"
          ? "تعذّر العثور على الخادم (DNS)"
          : code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT"
            ? "الاتصال مرفوض أو محجوب (جدار ناري / بروكسي)"
            : code && /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|LEAF_SIGNATURE/.test(code)
              ? "شهادة SSL للخادم غير موثوقة من Node"
              : "تعذّر الاتصال";
    console.error(`[arcgis] ${init.method ?? "GET"} ${host} failed:`, code, cause?.message ?? error);
    throw new Error(`${reason} — ${host}${code ? ` (${code})` : ""}`, { cause: error });
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return `عنوان غير صالح: "${url}"`;
  }
}
