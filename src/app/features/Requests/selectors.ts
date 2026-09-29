/**
 * The single mapping from a backend request row (SDI.Transaction, FeatureServer/5)
 * to what the table renders.
 *
 * It lives here because there are TWO places a row enters the list — the initial
 * query in `RequestsView`, and the row appended optimistically by `RequestFormModal`
 * after a successful submit — and they were each shaping it by hand. The two drifted:
 * the optimistic row omitted the description entirely, so a newly added request showed
 * "—" until the page was reloaded and the query path filled it in.
 *
 * Both paths now go through `toRequestRow`, so a row added to the list is identical to
 * the row that comes back on the next load, by construction.
 *
 * No React: pure attribute → view-model shaping.
 */

export type RequestRow = {
  id: number;
  createdAt: number;
  status: string;
  description?: string;
  /** USER_ID — the owning office's الرقم الوطني. What the list is filtered on. */
  userId?: string;
  /** WORKFLOW_STEPS — which step of SDI.Workflow_Steps the request sits on. */
  workflowStep?: string;
  /** REQUEST_NO — the request number, stamped at creation. See REQUEST_FIELDS.requestNo. */
  requestNo?: string;
  /** COMMENT_ — the reviewer's note back to the office. */
  comment?: string;
  /** Raw STATUS code, kept alongside the label so the admin screen can group and compare
   *  without re-deriving it from translated text. */
  statusCode?: number | null;
};

/** The fields this feature reads off the layer. */
export type RequestAttributes = {
  OBJECTID: number;
  DESCRIPTION: string | null;
  DATE_: number | null;
  STATUS: number | null;
  USER_ID: string | null;
  WORKFLOW_STEPS: string | null;
  REQUEST_NO: string | null;
  COMMENT_: string | null;
};

/** Field names on the backend table, so the two files can't disagree on spelling. */
export const REQUEST_FIELDS = {
  objectId: "OBJECTID",
  description: "DESCRIPTION",
  date: "DATE_",
  status: "STATUS",
  /** مسار العمل — which step of SDI.Workflow_Steps this request sits on. See workflow.ts. */
  workflowSteps: "WORKFLOW_STEPS",
  /** The owning engineering office's الرقم الوطني (String 255). Every request belongs to
   *  exactly one office, and the list is scoped by it. */
  userId: "USER_ID",
  /** رقم الطلب — a String(150) on the service, stamped at creation from the submission
   *  timestamp. A STRING field, so the value is written as text, never as a number. */
  requestNo: "REQUEST_NO",
  /** التعليق — the reviewer's note sent back with a "رد بملاحظات" decision. */
  comment: "COMMENT_",
} as const;

/**
 * STATUS codes on SDI.Transaction — the field's own coded-value domain, verified live.
 * All seven, so nothing has to be inferred from a translated label.
 */
export const REQUEST_STATUS = {
  NEW: 1,
  IN_PROGRESS: 2,
  RESUBMITTED: 3,
  REPLIED_WITH_NOTES: 4,
  ACCEPTED: 5,
  APPROVED: 6,
  REJECTED: 7,
} as const;

/** The columns the list needs — used as `outFields` by both the list query and the
 *  re-query the form runs on the row it just created. */
export const REQUEST_OUT_FIELDS: string[] = [
  REQUEST_FIELDS.objectId,
  REQUEST_FIELDS.description,
  REQUEST_FIELDS.date,
  REQUEST_FIELDS.status,
  REQUEST_FIELDS.workflowSteps,
  REQUEST_FIELDS.userId,
  REQUEST_FIELDS.requestNo,
  REQUEST_FIELDS.comment,
];

/**
 * STATUS labels, taken from the field's own coded-value domain on the live service
 * (verified 2026-09-27). All SEVEN codes are listed: the previous version handled only 1–3
 * and defaulted everything else to "جديد", so a rejected or approved request displayed as
 * new — the exact opposite of its real state.
 *
 * An unknown code now says so rather than being silently relabelled.
 */
const STATUS_LABELS: Record<number, string> = {
  1: "جديد",
  2: "تحت المعالجة",
  3: "إعادة إرسال",
  4: "رد بملاحظات",
  5: "قبول",
  6: "معتمد",
  7: "رفض",
};

export function getStatusLabel(status: number | null): string {
  if (status === null || status === undefined) return "جديد";
  return STATUS_LABELS[status] ?? `غير معروف (${status})`;
}

/**
 * Shapes one backend row for the table.
 *
 * `fallbackId` covers the one case the attributes can't: a service that does not echo
 * OBJECTID back on the re-query, where `applyEdits` already told us the id.
 */
export function toRequestRow(
  attributes: Partial<RequestAttributes> | undefined,
  fallbackId?: number,
): RequestRow {
  return {
    id: attributes?.OBJECTID ?? fallbackId ?? 0,
    createdAt: attributes?.DATE_ ?? Date.now(),
    status: getStatusLabel(attributes?.STATUS ?? null),
    description: attributes?.DESCRIPTION ?? "",
    userId: attributes?.USER_ID ?? undefined,
    workflowStep: attributes?.WORKFLOW_STEPS ?? undefined,
    requestNo: attributes?.REQUEST_NO ?? undefined,
    comment: attributes?.COMMENT_ ?? undefined,
    statusCode: attributes?.STATUS ?? null,
  };
}
