"use client";

/**
 * The request workflow (مسار العمل) — where a request currently sits, and what comes next.
 *
 * The service models this in TWO places, and it matters not to confuse them:
 *
 *  - `SDI.Workflow_Steps` (table 3) is a LOOKUP defining the step graph. It has only
 *    `CURRENT_STEPS` / `NEXT_STEPS` (both String 255) and NO `TRANSACTION_ID`, so it is not
 *    per-request history — it is the vocabulary and the ordering, shared by every request.
 *  - `SDI.Transaction.WORKFLOW_STEPS` (String 255) is where an individual request records
 *    which step it is on.
 *
 * So "storing the workflow" on submit means: read the entry step from the lookup, and stamp
 * it on the new request row.
 *
 * ⚠️ The step NAMES are deliberately not hardcoded here. `Workflow_Steps` is currently
 * EMPTY (0 rows), so there is no authoritative vocabulary to read, and inventing Arabic step
 * labels would bake a guess at municipal process wording into live data that later steps
 * depend on. Populate that table and this resolves the entry step automatically, with no
 * code change. Until then a submitted request stores NULL for its step, which is honest —
 * "unknown", not a fabricated first step.
 *
 * No JSX: transport + pure graph logic.
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { regulationLayerUrl, REGULATION_LAYERS } from "@/lib/arcgis";

/** Field names on the Workflow_Steps lookup — read off the live service, not guessed. */
export const WORKFLOW_FIELDS = {
  current: "CURRENT_STEPS",
  next: "NEXT_STEPS",
} as const;

export type WorkflowStep = {
  /** The step's own name — the value written to `SDI.Transaction.WORKFLOW_STEPS`. */
  current: string;
  /** The step that follows it, or null for a terminal step. */
  next: string | null;
};

let cachedSteps: WorkflowStep[] | null = null;

/**
 * Reads the whole step graph from `SDI.Workflow_Steps` (FeatureServer/3).
 *
 * Cached per page load for read-only uses (the list's "next step" column): it is small,
 * shared reference data that changes when an administrator edits the table, not during a
 * session.
 *
 * `refresh: true` bypasses that cache. Submitting MUST use it: the step a request moves to
 * has to be decided against the table as it is right now, not against a copy taken when the
 * page loaded — and the request is then a real, visible call to FeatureServer/3 in the
 * browser's network tab rather than a silent cache hit.
 */
export async function fetchWorkflowSteps(
  options: { refresh?: boolean } = {},
): Promise<WorkflowStep[]> {
  if (cachedSteps && !options.refresh) return cachedSteps;

  const layer = new FeatureLayer({
    url: regulationLayerUrl(REGULATION_LAYERS.WORKFLOW_STEPS_TABLE),
    outFields: ["*"],
  });

  await layer.load();

  const result = await layer.queryFeatures({
    where: "1=1",
    outFields: [WORKFLOW_FIELDS.current, WORKFLOW_FIELDS.next],
    returnGeometry: false,
  });

  cachedSteps = (result.features ?? []).flatMap((feature) => {
    const attributes = feature.attributes ?? {};
    const current = attributes[WORKFLOW_FIELDS.current];
    if (typeof current !== "string" || current.trim() === "") return [];

    const next = attributes[WORKFLOW_FIELDS.next];
    return [
      {
        current: current.trim(),
        next: typeof next === "string" && next.trim() !== "" ? next.trim() : null,
      },
    ];
  });

  return cachedSteps;
}

/**
 * The step a brand-new request starts on: the ROOT of the graph — the one step that is
 * nobody else's `NEXT_STEPS`.
 *
 * Falling back to the first row when no unique root exists (a cyclic or partially filled
 * table) keeps a badly configured lookup from blocking submissions outright.
 * `null` only when the table is empty.
 */
export function resolveInitialStep(steps: WorkflowStep[]): string | null {
  if (steps.length === 0) return null;

  const referencedAsNext = new Set(steps.map((step) => step.next).filter(Boolean) as string[]);
  const roots = steps.filter((step) => !referencedAsNext.has(step.current));

  if (roots.length === 1) return roots[0].current;

  return roots[0]?.current ?? steps[0].current;
}

/** The step that follows `current`, for advancing a request later. `null` when `current` is
 *  terminal or unknown to the lookup. */
export function nextStepAfter(steps: WorkflowStep[], current: string | null): string | null {
  if (!current) return null;
  return steps.find((step) => step.current === current)?.next ?? null;
}

/**
 * The step value to stamp on a request being submitted now.
 *
 * Never throws: the workflow lookup being unreachable or empty must not stop a request from
 * being created — the step is recorded as NULL and can be set once the lookup is populated.
 */
export async function resolveStepForNewRequest(): Promise<string | null> {
  try {
    const step = resolveInitialStep(await fetchWorkflowSteps());

    if (!step) {
      console.warn(
        "[requests] SDI.Workflow_Steps is empty — the new request will store no workflow step.",
      );
    }

    return step;
  } catch (error) {
    console.error("[requests] failed to read the workflow steps lookup:", error);
    return null;
  }
}
