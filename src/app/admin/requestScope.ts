/**
 * Which rows of SDI.Transaction belong on a department's admin card — as a where-clause.
 *
 * Three kinds of request belong there:
 *
 *  1. The QUEUE — `WORKFLOW_STEPS = '<DEPT_ID>'`. Waiting on the department, and also every
 *     request it ACCEPTED: accepting records the status only and leaves the step alone.
 *
 *  2. What it RETURNED to the office — rejected (رفض, 7) or replied-with-notes (4). Both reset
 *     `WORKFLOW_STEPS` to the workflow's origin step so the office can act (and re-send), which
 *     takes them out of clause 1. They are found again from the workflow graph: a request
 *     back on the origin step with one of those two statuses was sent back by the department
 *     that FOLLOWS the origin — the only desk the office sends to. This lives on the service,
 *     so every browser sees it, after any reload.
 *
 *  3. Ids this browser remembers deciding (handledRequests.ts) — the old, per-browser
 *     mechanism, kept as a supplement for any row clause 2 cannot attribute.
 *
 * ⚠️ Clause 2 attributes a returned request to the origin's DIRECT successor. On today's graph
 * (`office → 201090`) that is exact. If the graph grows a second reviewing step
 * (office → A → B), a rejection by B would also land back on the origin and be shown to A —
 * the table has no column recording which department decided. The durable fix is that column
 * (e.g. `HANDLED_BY_DEPT` on SDI.Transaction); until then only the first department receives
 * clause 2, so no department ever sees a rejection it could not have made on today's graph.
 *
 * Pure: no ArcGIS, no React — unit-tested in requestScope.test.ts.
 */

import { REQUEST_FIELDS, REQUEST_STATUS } from "../features/Requests/selectors";
import {
  nextStepAfter,
  resolveInitialStep,
  type WorkflowStep,
} from "../features/Requests/workflow";

/** Statuses that send a request back to the office's origin step. */
export const RETURNED_TO_OFFICE_STATUSES = [
  REQUEST_STATUS.REJECTED,
  REQUEST_STATUS.REPLIED_WITH_NOTES,
] as const;

const DEPT_ID_PATTERN = /^\d{1,20}$/;

/** SQL string literal: single quotes doubled, so a step name can never end the literal. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Clause 2 — the requests this department sent back to the office — or `null` when this
 * department is not the one the office sends to (or the graph has no origin).
 */
export function returnedToOfficeClause(
  steps: WorkflowStep[],
  deptId: string,
): string | null {
  const origin = resolveInitialStep(steps);
  if (!origin || nextStepAfter(steps, origin) !== deptId) return null;

  return (
    `(${REQUEST_FIELDS.status} IN (${RETURNED_TO_OFFICE_STATUSES.join(",")})` +
    ` AND ${REQUEST_FIELDS.workflowSteps} = ${sqlString(origin)})`
  );
}

/**
 * The full where-clause: queue OR returned-to-office OR remembered ids.
 *
 * `deptId` is validated as digits and the ids as integers before interpolation, so nothing
 * but numbers — and the escaped origin step — can reach the service.
 */
export function departmentWhere(
  deptId: string,
  options: { returnedClause?: string | null; handledIds?: number[] } = {},
): string {
  if (!DEPT_ID_PATTERN.test(deptId)) {
    throw new Error("رقم الإدارة غير صالح.");
  }

  const clauses = [`(${REQUEST_FIELDS.workflowSteps} = '${deptId}')`];

  if (options.returnedClause) clauses.push(options.returnedClause);

  const ids = (options.handledIds ?? []).filter((id) => Number.isInteger(id));
  if (ids.length > 0) clauses.push(`(${REQUEST_FIELDS.objectId} IN (${ids.join(",")}))`);

  return clauses.join(" OR ");
}
