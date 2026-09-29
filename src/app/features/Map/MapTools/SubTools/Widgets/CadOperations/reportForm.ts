"use client";

/**
 * The details a person fills in before the survey report is exported.
 *
 * Everything here is information the CAD file and the spatial query cannot supply — who owns
 * the plot, who signed the report, what physically bounds each side on the ground, and the
 * three photos of the building. The rest
 * of the sheet (البلدية / الحي, the coordinates, the areas, the computed lengths)
 * stays derived, so nothing measured can be typed over by accident.
 *
 * Lengths are NOT collected: every one of them is measured from the drawing, and a second
 * source for the same number is a second chance to disagree with it.
 *
 * No React: a value type, its empty value, and the rules it must satisfy.
 */

import type { Direction } from "./reportGeometry";

export type ReportFormValues = {
  owner: {
    name: string;
    nationalId: string;
    mobile: string;
    email: string;
  };
  property: {
    /** الاستخدام — typed by the office, never taken from the CAD file or the land-use layer. */
    use: string;
    /** مشتملات الموقع — what stands on the site. */
    siteContents: string;
  };
  office: {
    /** المهندس معد التقرير. */
    engineerName: string;
    /** مدير المكتب الهندسي. */
    managerName: string;
  };
  /** الحد — what bounds the property on each side (a street, a neighbour, a wall).
   *  The LENGTH is not here on purpose: it is measured from the drawing, so offering it as
   *  an input would invite a typed number to contradict the geometry on the same page. */
  borders: Record<Direction, string>;
  /** صور المبنى — the three building photos, as JPEG data URLs (see buildingPhotos.ts).
   *  "" = not attached yet. They fill the three "صورة للمبنى" boxes beside the QR code. */
  photos: BuildingPhotos;
};

export const BUILDING_PHOTO_COUNT = 3;
export type BuildingPhotos = [string, string, string];

export const DIRECTION_KEYS: Direction[] = ["north", "south", "east", "west"];

export const EMPTY_REPORT_FORM: ReportFormValues = {
  owner: { name: "", nationalId: "", mobile: "", email: "" },
  property: { use: "", siteContents: "" },
  office: { engineerName: "", managerName: "" },
  borders: { north: "", south: "", east: "", west: "" },
  photos: ["", "", ""],
};

/** Trimmed, or undefined — so a field of spaces prints as blank rather than as whitespace. */
export function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/* ── Validation ──────────────────────────────────────────────────────────────
 *
 * The report is a signed municipal document, so a field that is present must be usable: a
 * malformed id or a mistyped mobile is worse on paper than an obviously empty line, because
 * it looks answered. Everything required here is something only the office can supply.
 */

/** Saudi national id / iqama: 10 digits starting with 1 or 2 — the same rule the login uses. */
const NATIONAL_ID_PATTERN = /^[12]\d{9}$/;

/** Saudi mobile: 10 digits starting 05. */
const MOBILE_PATTERN = /^05\d{8}$/;

/** Required by the municipality for this form: a Gmail address specifically. */
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

export const REPORT_FORM_ERRORS = {
  required: "هذا الحقل مطلوب",
  nationalId: "رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2",
  mobile: "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05",
  email: "يجب إدخال بريد إلكتروني ينتهي بـ @gmail.com",
  photo: "يجب إرفاق الصورة",
} as const;

/** Dotted keys ("owner.name", "borders.north") so a field can look its own error up. */
export type ReportFormErrors = Record<string, string>;

/**
 * Every problem with the form, keyed by field. An empty object means it may be exported.
 *
 * All fields are reported at once rather than stopping at the first, so the office fixes the
 * form in one pass instead of discovering the next error after each correction.
 */
export function validateReportForm(values: ReportFormValues): ReportFormErrors {
  const errors: ReportFormErrors = {};

  const requireText = (key: string, value: string) => {
    if (!value.trim()) errors[key] = REPORT_FORM_ERRORS.required;
  };

  requireText("owner.name", values.owner.name);
  requireText("property.use", values.property.use);
  requireText("office.engineerName", values.office.engineerName);
  requireText("office.managerName", values.office.managerName);

  const nationalId = values.owner.nationalId.trim();
  if (!nationalId) errors["owner.nationalId"] = REPORT_FORM_ERRORS.required;
  else if (!NATIONAL_ID_PATTERN.test(nationalId)) {
    errors["owner.nationalId"] = REPORT_FORM_ERRORS.nationalId;
  }

  const mobile = values.owner.mobile.trim();
  if (!mobile) errors["owner.mobile"] = REPORT_FORM_ERRORS.required;
  else if (!MOBILE_PATTERN.test(mobile)) errors["owner.mobile"] = REPORT_FORM_ERRORS.mobile;

  const email = values.owner.email.trim();
  if (!email) errors["owner.email"] = REPORT_FORM_ERRORS.required;
  else if (!GMAIL_PATTERN.test(email)) errors["owner.email"] = REPORT_FORM_ERRORS.email;

  for (const direction of DIRECTION_KEYS) {
    requireText(`borders.${direction}`, values.borders[direction]);
  }

  // All three building photos are mandatory: the sheet has three boxes for them and a
  // report with an empty one would go out looking incomplete.
  values.photos.forEach((photo, index) => {
    if (!photo) errors[`photos.${index}`] = REPORT_FORM_ERRORS.photo;
  });

  return errors;
}
