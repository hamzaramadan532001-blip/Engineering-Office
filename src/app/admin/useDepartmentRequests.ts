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
import { decideRequest, fetchAllRequests, replyWithNote } from "./departmentRequests";
import { apiUrl } from "@/lib/api";

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
        const response = await fetch(apiUrl("/api/admin/employee"), { cache: "no-store" });
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
    // Every request is listed (see fetchAllRequests), but only for a signed-in employee with a
    // department: the department is what decides which rows may be acted on.
    if (!deptId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRequests(await fetchAllRequests());
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
    [reload],
  );

  const sendNote = useCallback(
    async (objectId: number, note: string) => {
      setSendingNoteId(objectId);
      setError(null);
      try {
        await replyWithNote(objectId, note);
        await reload();
      } catch (noteError) {
        console.error("[admin] failed to send the note:", noteError);
        setError(noteError instanceof Error ? noteError.message : "تعذّر إرسال الملاحظة.");
      } finally {
        setSendingNoteId(null);
      }
    },
    [reload],
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
