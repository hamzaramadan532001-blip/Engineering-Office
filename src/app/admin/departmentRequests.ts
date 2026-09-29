"use client";

/**
 * Data access for the admin's request list, and the accept / reject / reply decisions
 * taken on it.
 *
 * The LIST is every request (`fetchAllRequests`). The right to DECIDE is scoped: a request
 * sits with a department when its `WORKFLOW_STEPS` equals that department's `DEPT_ID` — the
 * workflow graph's NEXT_STEPS values ARE department ids (`office → 201090 → 2010`) — and only
 * that department may decide it (`canDecide`).
 *
 * Decisions are written to `STATUS`, using the field's own coded-value domain rather than a
 * parallel vocabulary: accept → 5 (قبول), reject → 7 (رفض), reply-with-notes → 4
 * (رد بملاحظات) plus the text in `COMMENT_`.
 *
 * No React here; the hook in `useDepartmentRequests.ts` owns the state.
 */

import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { regulationLayerUrl, REGULATION_LAYERS } from "@/lib/arcgis";
import {
  REQUEST_FIELDS,
  REQUEST_OUT_FIELDS,
  REQUEST_STATUS,
  toRequestRow,
  type RequestRow,
} from "../features/Requests/selectors";
import { fetchWorkflowSteps, resolveInitialStep } from "../features/Requests/workflow";

const REQUEST_LAYER_URL = regulationLayerUrl(REGULATION_LAYERS.TRANSACTIONS_TABLE);

/**
 * Where a rejected request goes back to: the engineering office that raised it.
 *
 * Resolved from the workflow graph rather than written in here — the ORIGIN step (the one
 * that is nobody else's NEXT_STEPS) is by definition the office's own step, and on the
 * current graph (`office → 201090`) that is exactly "office". Deriving it means a renamed or
 * extended workflow keeps working.
 *
 * The literal below is only a fallback for an unreadable or empty lookup: a rejection must
 * still record itself even if the graph cannot be read, and this is the value the workflow
 * table actually holds today.
 */
const FALLBACK_OFFICE_STEP = "office";

async function resolveOfficeStep(): Promise<string> {
  try {
    const origin = resolveInitialStep(await fetchWorkflowSteps({ refresh: true }));
    if (origin) return origin;
    console.warn("[admin] the workflow graph has no origin step — falling back to 'office'.");
  } catch (error) {
    console.error("[admin] could not read the workflow graph for the rejection step:", error);
  }
  return FALLBACK_OFFICE_STEP;
}

/** The tab a request falls under. Mirrors the three signup-style tabs the screen already had. */
export type DecisionFilter = "pending" | "approved" | "rejected" | "all";

/**
 * Which STATUS codes each tab covers.
 *
 * `pending` is "awaiting THIS department's decision": new, in processing, or resubmitted
 * after notes. Code 4 (رد بملاحظات) is deliberately in none of the three — the department has
 * already acted on it and the ball is with the office — so it surfaces under "الكل".
 */
const STATUS_GROUPS: Record<Exclude<DecisionFilter, "all">, number[]> = {
  pending: [REQUEST_STATUS.NEW, REQUEST_STATUS.IN_PROGRESS, REQUEST_STATUS.RESUBMITTED],
  approved: [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.APPROVED],
  rejected: [REQUEST_STATUS.REJECTED],
};

export function matchesFilter(request: RequestRow, filter: DecisionFilter): boolean {
  if (filter === "all") return true;
  const code = request.statusCode;
  if (code === null || code === undefined) return filter === "pending";
  return STATUS_GROUPS[filter].includes(code);
}

/** True when this request is still waiting on a decision. */
export function isPending(request: RequestRow): boolean {
  return matchesFilter(request, "pending");
}

/**
 * May THIS department accept / reject / reply to the request?
 *
 * Only when it is pending AND sitting on this department's own workflow step. Seeing every
 * request is fine; deciding one that is with another department (or not sent yet) would
 * skip that department's review, so those rows are shown without actions.
 */
export function canDecide(request: RequestRow, deptId: string | null): boolean {
  return deptId !== null && request.workflowStep === deptId && isPending(request);
}

let layer: FeatureLayer | null = null;

async function getLayer(): Promise<FeatureLayer> {
  if (!layer) {
    layer = new FeatureLayer({ url: REQUEST_LAYER_URL, outFields: ["*"] });
  }
  await layer.load();
  return layer;
}

/**
 * EVERY request in SDI.Transaction — whichever office raised it and whichever step it is on.
 *
 * The card used to list only its own department's step (plus what it had sent back), which
 * hid every request sitting with another department or not yet sent. A reviewer needs the
 * whole picture, so the list is unscoped; what stays scoped is the right to DECIDE — see
 * `canDecide`.
 */
export async function fetchAllRequests(): Promise<RequestRow[]> {
  const featureLayer = await getLayer();

  const result = await featureLayer.queryFeatures({
    where: "1=1",
    outFields: REQUEST_OUT_FIELDS,
    returnGeometry: false,
    orderByFields: ["OBJECTID DESC"],
  });

  return (result.features ?? []).map((feature) => toRequestRow(feature.attributes));
}

async function applyStatus(
  objectId: number,
  attributes: Record<string, unknown>,
): Promise<void> {
  const featureLayer = await getLayer();

  if (!featureLayer.capabilities?.operations?.supportsUpdate) {
    throw new Error("الخدمة لا تسمح بتحديث حالة الطلب.");
  }

  const result = await featureLayer.applyEdits({
    updateFeatures: [
      new Graphic({ attributes: { [REQUEST_FIELDS.objectId]: objectId, ...attributes } }),
    ],
  });

  const updateResult = result.updateFeatureResults?.[0];
  if (!updateResult || updateResult.error) {
    throw new Error(updateResult?.error?.message ?? "تعذّر تحديث حالة الطلب.");
  }
}

/**
 * Accept (قبول) or reject (رفض).
 *
 * Accepting records the decision only — the request stays parked with this department.
 *
 * Rejecting ALSO routes the request back to the engineering office by resetting
 * `WORKFLOW_STEPS` to the workflow's origin step: a rejected request is no longer waiting on
 * this department, so leaving it in the department's queue would keep it on a desk that has
 * already finished with it. Both fields go in ONE applyEdits, so the status and the routing
 * can never end up disagreeing.
 */
export async function decideRequest(
  objectId: number,
  decision: "approved" | "rejected",
): Promise<void> {
  if (decision === "approved") {
    await applyStatus(objectId, { [REQUEST_FIELDS.status]: REQUEST_STATUS.ACCEPTED });
    return;
  }

  await applyStatus(objectId, {
    [REQUEST_FIELDS.status]: REQUEST_STATUS.REJECTED,
    [REQUEST_FIELDS.workflowSteps]: await resolveOfficeStep(),
  });
}

/**
 * رد بملاحظات — the reviewer's note back to the engineering office.
 *
 * Writes all three in ONE applyEdits, because they are one decision and must not be able to
 * disagree: the note text into `COMMENT_`, `STATUS` to 4 (رد بملاحظات) so the office knows it
 * has something to answer, and `WORKFLOW_STEPS` back to the workflow's origin step — the
 * request is now waiting on the office, not on this department, so it leaves the department's
 * queue the same way a rejection does.
 */
export async function replyWithNote(objectId: number, note: string): Promise<void> {
  const trimmed = note.trim().slice(0, 255); // COMMENT_ is String(255)
  if (!trimmed) throw new Error("الملاحظة فارغة.");

  await applyStatus(objectId, {
    [REQUEST_FIELDS.comment]: trimmed,
    [REQUEST_FIELDS.status]: REQUEST_STATUS.REPLIED_WITH_NOTES,
    [REQUEST_FIELDS.workflowSteps]: await resolveOfficeStep(),
  });
}
