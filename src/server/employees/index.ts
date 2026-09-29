/**
 * Lookup of a municipality employee by ID / residency number, for the admin login.
 *
 * SERVER ONLY — same reasoning as src/server/engineeringOffices: it queries the secured
 * FeatureServer with `ARCGIS_SERVER_TOKEN`, and a login decision must not be made in the
 * browser where it could be bypassed.
 *
 * Tables (verified live 2026-09-27):
 *  - layer 6 `SDI.EMPLOYEES`   — FIRST_NAME, LAST_NAME, EMP_NUMBER, DEPT_ID (Integer),
 *                                AD, IDENTITY_NO (String 15 ← the number typed at login)
 *  - layer 7 `SDI.DEPARTMENTS` — DEPT_ID (Integer) → DEPT_NAME
 *
 * DEPT_ID is the point of all this: it is also what a request's `WORKFLOW_STEPS` holds once
 * the request is routed onward (the workflow graph's NEXT_STEPS values ARE department ids),
 * so an employee's department id is exactly the key for "the requests waiting on my desk".
 */

import { REGULATION_LAYERS } from "@/lib/arcgis";

const SERVICE_URL =
  process.env.ARCGIS_REGULATION_TRANSACTIONS_URL ??
  "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/Regulation571EditTrans/FeatureServer";

export type Employee = {
  objectId: number;
  firstName: string;
  lastName: string;
  /** "FIRST LAST" — what the greeting shows. */
  fullName: string;
  empNumber: number | null;
  /** The ID / residency number used to sign in. */
  identityNo: string;
  /** Department id. Kept as a STRING because a request's WORKFLOW_STEPS stores it as text. */
  deptId: string | null;
  /** Resolved from SDI.DEPARTMENTS; null when that table has no row for the id. */
  deptName: string | null;
};

type EmployeeAttributes = {
  OBJECTID: number;
  FIRST_NAME: string | null;
  LAST_NAME: string | null;
  EMP_NUMBER: number | null;
  DEPT_ID: number | null;
  AD: string | null;
  IDENTITY_NO: string | null;
};

/** Only digits are interpolated into a where-clause — validated, not escaped, so no quote
 *  or comment marker can reach it. ID/iqama numbers are 10 digits; the field allows 15. */
function isWellFormedIdentityNo(value: string): boolean {
  return /^\d{6,15}$/.test(value);
}

async function queryLayer(
  layerId: number,
  where: string,
  outFields: string,
): Promise<Array<{ attributes: Record<string, unknown> }>> {
  const token = process.env.ARCGIS_SERVER_TOKEN;
  if (!token) {
    throw new Error("ARCGIS_SERVER_TOKEN غير موجود — لا يمكن التحقق من بيانات الموظفين.");
  }

  const body = new URLSearchParams({
    f: "json",
    token,
    where,
    outFields,
    returnGeometry: "false",
  });

  const response = await fetch(`${SERVICE_URL}/${layerId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`تعذّر الاتصال بخدمة بيانات الموظفين (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    features?: Array<{ attributes: Record<string, unknown> }>;
  };

  if (payload.error) {
    throw new Error(payload.error.message ?? "تعذّر قراءة بيانات الموظفين.");
  }

  return payload.features ?? [];
}

/** DEPT_NAME for a department id, or null when the departments table has no such row. */
async function findDepartmentName(deptId: number): Promise<string | null> {
  try {
    const rows = await queryLayer(
      REGULATION_LAYERS.DEPARTMENTS_TABLE,
      `DEPT_ID = ${Number(deptId)}`,
      "DEPT_ID,DEPT_NAME",
    );
    const name = rows[0]?.attributes?.DEPT_NAME;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch (error) {
    // A missing department name must never block a valid login — it is a label, not a
    // credential.
    console.error("[admin] failed to resolve the department name:", error);
    return null;
  }
}

/**
 * The employee registered under this ID / residency number, or `null` when there is none.
 *
 * `null` is the "no access" answer the login screen acts on. A genuine failure (token
 * rejected, service down) THROWS, so nobody is refused access because of an outage.
 */
export async function findEmployeeByIdentityNo(identityNo: string): Promise<Employee | null> {
  const trimmed = identityNo.trim();
  if (!isWellFormedIdentityNo(trimmed)) return null;

  // IDENTITY_NO is a String field → compared as a quoted string.
  const rows = await queryLayer(
    REGULATION_LAYERS.EMPLOYEES_TABLE,
    `IDENTITY_NO = '${trimmed}'`,
    "*",
  );

  const attributes = rows[0]?.attributes as EmployeeAttributes | undefined;
  if (!attributes) return null;

  const firstName = attributes.FIRST_NAME?.trim() ?? "";
  const lastName = attributes.LAST_NAME?.trim() ?? "";
  const deptId = attributes.DEPT_ID;

  return {
    objectId: attributes.OBJECTID,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    empNumber: attributes.EMP_NUMBER ?? null,
    identityNo: attributes.IDENTITY_NO?.trim() ?? trimmed,
    deptId: deptId === null || deptId === undefined ? null : String(deptId),
    deptName:
      deptId === null || deptId === undefined ? null : await findDepartmentName(deptId),
  };
}
