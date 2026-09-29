"use client";

/**
 * Sends a request on to its next workflow step, with the PDF that justifies the move.
 *
 * The order of operations is deliberate: the document is attached FIRST, and only once it
 * has landed is `WORKFLOW_STEPS` advanced. Advancing the step is the part a reviewer acts
 * on, so it must never happen for a submission whose attachment silently failed — a step
 * that moved without its paperwork is worse than a failed send the user can retry.
 *
 * "Which step comes next" is answered by the service, not by this code: the request's
 * current `WORKFLOW_STEPS` value is looked up in the `SDI.Workflow_Steps` graph
 * (CURRENT_STEPS → NEXT_STEPS) and the successor is whatever that table says. Nothing about
 * the step vocabulary is hardcoded here.
 *
 * No JSX: transport + the step decision.
 */
   
import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { regulationLayerUrl, REGULATION_LAYERS } from "@/lib/arcgis";
import { REQUEST_FIELDS, REQUEST_OUT_FIELDS, REQUEST_STATUS } from "./selectors";
import { fetchWorkflowSteps, nextStepAfter, resolveInitialStep } from "./workflow";

const REQUEST_LAYER_URL = regulationLayerUrl(REGULATION_LAYERS.TRANSACTIONS_TABLE);

export type AdvanceResult = {
  /** The step the request was on before the send (null when it had none). */
  from: string | null;
  /** The step it is on now. */
  to: string;
};

/**
 * Thrown when the workflow graph cannot say where to go next. Separated from a transport
 * failure so the UI can explain the difference: an empty or terminal graph is a
 * configuration answer, not an outage.
 */
export class NoNextStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoNextStepError";
  }
}

/**
 * Attaches `file` to the request and moves it to the next step.
 *
 * A request whose `WORKFLOW_STEPS` is still NULL (every existing row, until the lookup is
 * populated) is placed on the graph's ENTRY step rather than rejected — "not started yet"
 * advances to "the first step", which is what sending it means.
 */
export async function advanceRequestWorkflow(
  objectId: number,
  file: File,
): Promise<AdvanceResult> {
  const layer = new FeatureLayer({ url: REQUEST_LAYER_URL, outFields: ["*"] });
  await layer.load();

  if (!layer.capabilities?.operations?.supportsUpdate) {
    throw new Error("الخدمة لا تسمح بتحديث مسار العمل.");
  }
  if (!layer.capabilities?.data?.supportsAttachment) {
    throw new Error("الخدمة لا تسمح بإرفاق الملفات.");
  }

  // Read the row fresh: the step shown in the table may be stale if someone else moved the
  // request on, and advancing from a stale step would skip or repeat one.
  const featureSet = await layer.queryFeatures({
    objectIds: [objectId],
    outFields: REQUEST_OUT_FIELDS,
    returnGeometry: false,
  });

  const feature = featureSet.features[0];
  if (!feature) {
    throw new Error("تعذّر العثور على الطلب في الخدمة.");
  }

  const currentRaw = feature.attributes?.[REQUEST_FIELDS.workflowSteps];
  const current = typeof currentRaw === "string" && currentRaw.trim() ? currentRaw.trim() : null;

  // Always re-queried, never served from the page-load cache: the decision must be made
  // against the table as it stands now, and the call is visible in the network tab.
  const steps = await fetchWorkflowSteps({ refresh: true });

  if (steps.length === 0) {
    throw new NoNextStepError(
      "لم يتم تعريف مسار العمل في الخدمة (جدول Workflow_Steps فارغ) — لا يمكن تحديد الخطوة التالية.",
    );
  }

  // A request with no step yet is treated as sitting on the graph's entry step, so that
  // sending it moves it to that step's NEXT_STEPS. Either way the value stored is the
  // SUCCESSOR — never the step the request is already on.
  const effectiveCurrent = current ?? resolveInitialStep(steps);
  const target = nextStepAfter(steps, effectiveCurrent);

  if (!target) {
    throw new NoNextStepError(
      effectiveCurrent
        ? `لا توجد خطوة تالية بعد «${effectiveCurrent}» — الطلب في الخطوة الأخيرة.`
        : "تعذّر تحديد خطوات مسار العمل.",
    );
  }

  // 1) The document first. If this fails the step stays where it is.
  const attachmentForm = new FormData();
  attachmentForm.set("attachment", file);
  attachmentForm.set("f", "json");

  const attachmentResult = await layer.addAttachment(feature, attachmentForm);

  if (attachmentResult.error) {
    throw new Error(attachmentResult.error.message ?? "تعذّر رفع الملف المرفق.");
  }

  // 2) Only now advance the step, and move the request into processing.
  const updated = new Graphic({
    attributes: {
      [REQUEST_FIELDS.objectId]: objectId,
      [REQUEST_FIELDS.workflowSteps]: target,
      [REQUEST_FIELDS.status]: REQUEST_STATUS.IN_PROGRESS,
    },
  });

  const editResult = await layer.applyEdits({ updateFeatures: [updated] });
  const updateResult = editResult.updateFeatureResults?.[0];

  if (!updateResult || updateResult.error) {
    throw new Error(updateResult?.error?.message ?? "تعذّر تحديث مسار العمل للطلب.");
  }

  return { from: effectiveCurrent, to: target };
}
