"use client";

/**
 * Remembers which requests this department has already decided — now a SUPPLEMENT.
 *
 * Rejected and replied-to requests are found on the service through the workflow graph
 * (requestScope.ts), for every browser. This per-browser list only still matters for a row
 * that rule cannot attribute (see the limitation there).
 *
 * Why this is needed: rejecting a request (or replying with notes) routes it back to the
 * office by setting `WORKFLOW_STEPS` to the origin step. The admin card is scoped by
 * `WORKFLOW_STEPS = <DEPT_ID>`, so a decided request drops straight out of the query — its
 * status is saved on the service, but the department can no longer see it. Keeping the ids
 * here lets the card ask for them explicitly and go on showing the outcome.
 *
 * ⚠️ LIMITATION, deliberately visible rather than hidden: this is per-browser memory. The
 * table `SDI.Transaction` has no field recording WHICH department handled a request — all
 * eight of its columns are already in use — so once `WORKFLOW_STEPS` moves away, nothing on
 * the server links the row back to this department. A colleague on another machine, or the
 * same person after clearing site data, will not see this history.
 *
 * The durable fix is a schema change: a `HANDLED_BY_DEPT` column on SDI.Transaction (or a
 * decisions table), which would let the query resolve this server-side for everyone.
 */

const STORAGE_PREFIX = "mmsdi.admin.handledRequests.";

/** Cap the remembered set so the key cannot grow without bound. Most recent kept. */
const MAX_REMEMBERED = 200;

function storageKey(deptId: string): string {
  return `${STORAGE_PREFIX}${deptId}`;
}

/** localStorage throws in private windows and when site data is blocked, and is absent
 *  during SSR — every access is guarded and degrades to "remember nothing". */
function readRaw(deptId: string): number[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(deptId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is number => Number.isInteger(id));
  } catch (error) {
    console.warn("[admin] could not read the handled-requests list:", error);
    return [];
  }
}

export function getHandledRequestIds(deptId: string): number[] {
  return readRaw(deptId);
}

/** Records one decided request. Most-recent-first, de-duplicated, capped. */
export function rememberHandledRequest(deptId: string, objectId: number): void {
  if (typeof window === "undefined" || !Number.isInteger(objectId)) return;

  const next = [objectId, ...readRaw(deptId).filter((id) => id !== objectId)].slice(
    0,
    MAX_REMEMBERED,
  );

  try {
    window.localStorage.setItem(storageKey(deptId), JSON.stringify(next));
  } catch (error) {
    // A full or blocked store must not break the decision that just succeeded.
    console.warn("[admin] could not record the handled request:", error);
  }
}
