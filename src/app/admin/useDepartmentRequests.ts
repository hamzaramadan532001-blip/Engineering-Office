"use client";

/**
 * State for the department's request queue.
 *
 * Deliberately exposes the SAME surface the old `useSignupRequests` did
 * (`requests / loading / error / decidingId / sendingNoteId / reload / decide / sendNote`),
 * so the screen's chrome — search, refresh, tabs, confirm and note modals, pagination —
 * carries over unchanged instead of being rebuilt around a new shape.
 *
 * The department comes from the admin session server-side (`GET /api/admin/employee`), never
 * from anything the browser could set.
 */

import { useCallback, useEffect, useState } from "react";
import type { RequestRow } from "../features/Requests/selectors";
import { decideRequest, fetchDepartmentRequests, replyWithNote } from "./departmentRequests";
import { getHandledRequestIds, rememberHandledRequest } from "./handledRequests";

export type SignedInEmployee = {
  fullName: string;
  deptId: string | null;
  deptName: string | null;
};

export function useDepartmentRequests() {
  const [employee, setEmployee] = useState<SignedInEmployee | null>(null);
  /** Separates "not looked up yet" from "no employee on this session". */
  const [employeeChecked, setEmployeeChecked] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [sendingNoteId, setSendingNoteId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/employee", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { employee?: SignedInEmployee | null };
          setEmployee(data.employee ?? null);
        }
      } catch (fetchError) {
        console.error("[admin] failed to read the signed-in employee:", fetchError);
      } finally {
        setEmployeeChecked(true);
      }
    })();
  }, []);

  const deptId = employee?.deptId ?? null;

  const reload = useCallback(async () => {
    // Never query unscoped — that would list every department's requests, which is a data
    // leak rather than just a wrong screen.
    if (!deptId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ask for the queue AND for anything this department has already decided, so a
      // rejected or replied-to request keeps showing its outcome instead of vanishing.
      setRequests(await fetchDepartmentRequests(deptId, getHandledRequestIds(deptId)));
    } catch (queryError) {
      console.error("[admin] failed to load the department's requests:", queryError);
      setError("تعذّر تحميل الطلبات من الخادم.");
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    if (!employeeChecked) return;
    void reload();
  }, [reload, employeeChecked]);

  const decide = useCallback(
    async (objectId: number, decision: "approved" | "rejected") => {
      setDecidingId(objectId);
      setError(null);
      try {
        await decideRequest(objectId, decision);
        // Recorded before the reload so the re-query already names this id — a rejection
        // moves WORKFLOW_STEPS away, and the row would otherwise be gone by then.
        if (deptId) rememberHandledRequest(deptId, objectId);
        await reload();
      } catch (decideError) {
        console.error("[admin] failed to record the decision:", decideError);
        setError(
          decideError instanceof Error ? decideError.message : "تعذّر تحديث حالة الطلب.",
        );
      } finally {
        setDecidingId(null);
      }
    },
    [reload, deptId],
  );

  const sendNote = useCallback(
    async (objectId: number, note: string) => {
      setSendingNoteId(objectId);
      setError(null);
      try {
        await replyWithNote(objectId, note);
        if (deptId) rememberHandledRequest(deptId, objectId);
        await reload();
      } catch (noteError) {
        console.error("[admin] failed to send the note:", noteError);
        setError(noteError instanceof Error ? noteError.message : "تعذّر إرسال الملاحظة.");
      } finally {
        setSendingNoteId(null);
      }
    },
    [reload, deptId],
  );

  return {
    employee,
    employeeChecked,
    requests,
    loading: loading || !employeeChecked,
    error,
    decidingId,
    sendingNoteId,
    reload,
    decide,
    sendNote,
  };
}
