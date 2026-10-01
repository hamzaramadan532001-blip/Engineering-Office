/**
 * Lookup of a qualified engineering office (المكاتب الهندسية المؤهلة) by its national
 * number — the identity the login screen accepts.
 *
 * SERVER ONLY. Two reasons, both hard requirements:
 *  1. It queries the secured FeatureServer with `ARCGIS_SERVER_TOKEN`, which must never
 *     reach the browser. (The `NEXT_PUBLIC_*` tokens the browser does get are, at time of
 *     writing, expired — so a client-side lookup would fail outright anyway.)
 *  2. Login decisions belong on the server. A browser-side "does this id exist" check
 *     would be trivially bypassable.
 *
 * The table is `QualifiedEngineeringOfficesCon` (layer 8 of Regulation571EditTrans) —
 * 116 rows, verified live 2026-09-27. `NATIONALNUMBER` is a String field, so it is matched
 * as a quoted string, not a number.
 */

import { REGULATION_LAYERS } from "@/lib/arcgis";
import { arcgisServerFetch, REGULATION_SERVICE_URL } from "@/server/arcgis";

/** Read straight from `process.env` — same pattern as app/api/cad/upload/route.ts. The
 *  client-side runtime config is not available (and not appropriate) here. */
const SERVICE_URL = REGULATION_SERVICE_URL;

const OFFICES_LAYER_URL = `${SERVICE_URL}/${REGULATION_LAYERS.ENGINEERING_OFFICES_TABLE}`;

/** One office row, in the shape the UI consumes. Arabic labels are on the service. */
export type EngineeringOffice = {
  objectId: number;
  /** The office's own sequence number (`ID`), not the OBJECTID. */
  officeId: number | null;
  /** اسم المكتب الهندسي — what the greeting shows. */
  name: string;
  /** الرقم الوطني — the number typed at login. */
  nationalNumber: string;
  email: string | null;
  contactNumber: string | null;
  /** Licence grades (أ / ب / ج), null where the office holds none. */
  licences: {
    construction: string | null;
    constructionSupervision: string | null;
    groupHousing: string | null;
    commercial: string | null;
    excavationSupervision: string | null;
  };
};

type OfficeAttributes = {
  OBJECTID: number;
  ID: number | null;
  ENGINEERINGOFFICEANAME: string | null;
  CONSTRUCTIONLICENSES: string | null;
  CONSTRUCTIONLICENSESUPERVISION: string | null;
  GROUPHOUSINGLICENSES: string | null;
  COMMERCIALLICENSES: string | null;
  EXCAVATIONSUPERVISION: string | null;
  EMAIL: string | null;
  NATIONALNUMBER: string | null;
  CONTACTNUMBER: string | null;
};

function toOffice(attributes: OfficeAttributes): EngineeringOffice {
  return {
    objectId: attributes.OBJECTID,
    officeId: attributes.ID ?? null,
    name: attributes.ENGINEERINGOFFICEANAME?.trim() ?? "",
    nationalNumber: attributes.NATIONALNUMBER?.trim() ?? "",
    email: attributes.EMAIL?.trim() || null,
    contactNumber: attributes.CONTACTNUMBER?.trim() || null,
    licences: {
      construction: attributes.CONSTRUCTIONLICENSES?.trim() || null,
      constructionSupervision: attributes.CONSTRUCTIONLICENSESUPERVISION?.trim() || null,
      groupHousing: attributes.GROUPHOUSINGLICENSES?.trim() || null,
      commercial: attributes.COMMERCIALLICENSES?.trim() || null,
      excavationSupervision: attributes.EXCAVATIONSUPERVISION?.trim() || null,
    },
  };
}

/**
 * Only digits are ever interpolated into the where-clause.
 *
 * The value reaches here from a request body, so it is validated rather than escaped:
 * a strict digits-only shape cannot carry a quote, a comment marker or a boolean tail,
 * which is what a where-clause injection needs.
 */
function isWellFormedNationalNumber(value: string): boolean {
  return /^\d{6,20}$/.test(value);
}

/**
 * The office registered under this national number, or `null` when there is none.
 *
 * `null` is the "not a registered office" answer the login screen acts on — it is not an
 * error. A genuine failure (token rejected, service down) throws, so the caller can tell
 * "you are not in the register" apart from "the register is unreachable" and not lock
 * someone out because of an outage.
 */
export async function findOfficeByNationalNumber(
  nationalNumber: string,
): Promise<EngineeringOffice | null> {
  const token = process.env.ARCGIS_SERVER_TOKEN;
  if (!token) {
    throw new Error("ARCGIS_SERVER_TOKEN غير موجود — لا يمكن التحقق من المكاتب الهندسية.");
  }

  const trimmed = nationalNumber.trim();
  if (!isWellFormedNationalNumber(trimmed)) return null;

  const body = new URLSearchParams({
    f: "json",
    token,
    where: `NATIONALNUMBER = '${trimmed}'`,
    outFields: "*",
    returnGeometry: "false",
  });

  const response = await arcgisServerFetch(`${OFFICES_LAYER_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    // Login must never read a cached answer.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`تعذّر الاتصال بسجل المكاتب الهندسية (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    features?: Array<{ attributes: OfficeAttributes }>;
  };

  if (payload.error) {
    throw new Error(
      payload.error.message
        ? `سجل المكاتب الهندسية: ${payload.error.message}`
        : "تعذّر قراءة سجل المكاتب الهندسية.",
    );
  }

  const attributes = payload.features?.[0]?.attributes;
  if (!attributes) return null;

  return toOffice(attributes);
}
