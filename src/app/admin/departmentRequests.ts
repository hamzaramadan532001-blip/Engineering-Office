"use client";

/**
 * Data access for the department's request queue, and the accept / reject / reply decisions
 * taken on it.
 *
 * Scoping: a request sits with a department when its `WORKFLOW_STEPS` equals that
 * department's `DEPT_ID` — the workflow graph's NEXT_STEPS values ARE department ids (its one
 * row today reads `office → 201090`, and 201090 is a DEPT_ID). So the queue is
 * `WORKFLOW_STEPS = '<DEPT_ID>'`.
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
import { departmentWhere, returnedToOfficeClause } from "./requestScope";

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

/** True when this request is still waiting on the department to decide. */
export function isPending(request: RequestRow): boolean {
  return matchesFilter(request, "pending");
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
 * Everything that belongs on the department's card: its queue (which includes what it
 * ACCEPTED), what it REJECTED or replied to, and any id this browser remembers deciding.
 *
 * Rejected and replied-to requests have had `WORKFLOW_STEPS` moved back to the office, so
 * they are found through the workflow graph rather than the department clause — on the
 * service, for every browser. See requestScope.ts for the rule and its one limitation.
 *
 * A graph that cannot be read degrades to queue + remembered ids (the previous behaviour)
 * rather than failing the whole card.
 */
export async function fetchDepartmentRequests(
  deptId: string,
  handledIds: number[] = [],
): Promise<RequestRow[]> {
  const featureLayer = await getLayer();

  let returnedClause: string | null = null;
  try {
    returnedClause = returnedToOfficeClause(await fetchWorkflowSteps({ refresh: true }), deptId);
  } catch (graphError) {
    console.error(
      "[admin] could not read the workflow graph — rejected requests may be missing:",
      graphError,
    );
  }

  const result = await featureLayer.queryFeatures({
    where: departmentWhere(deptId, { returnedClause, handledIds }),
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
