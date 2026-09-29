import { useCallback, useEffect, useState } from "react";
import {
  decideSignupRequest,
  fetchSignupRequests,
  sendSignupRequestNote,
  type SignupRequestDTO,
} from "./api";

interface State {
  requests: SignupRequestDTO[];
  loading: boolean;
  error: string | null;
  decidingId: string | null;
  sendingNoteId: string | null;
}

export function useSignupRequests() {
  const [state, setState] = useState<State>({
    requests: [],
    loading: true,
    error: null,
    decidingId: null,
    sendingNoteId: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const requests = await fetchSignupRequests();
      setState((s) => ({ ...s, requests, loading: false }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: "تعذّر تحميل الطلبات. حاول مرة أخرى." }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(async (id: string, status: "approved" | "rejected") => {
    setState((s) => ({ ...s, decidingId: id, error: null }));
    try {
      const updated = await decideSignupRequest(id, status);
      setState((s) => ({
        ...s,
        decidingId: null,
        requests: s.requests.map((r) => (r.id === updated.id ? updated : r)),
      }));
    } catch {
      setState((s) => ({ ...s, decidingId: null, error: "تعذّر تنفيذ العملية. حاول مرة أخرى." }));
    }
  }, []);

  const sendNote = useCallback(async (id: string, note: string) => {
    setState((s) => ({ ...s, sendingNoteId: id, error: null }));
    try {
      const updated = await sendSignupRequestNote(id, note);
      setState((s) => ({
        ...s,
        sendingNoteId: null,
        requests: s.requests.map((r) => (r.id === updated.id ? updated : r)),
      }));
    } catch {
      setState((s) => ({ ...s, sendingNoteId: null, error: "تعذّر إرسال الملاحظة. حاول مرة أخرى." }));
    }
  }, []);

  return { ...state, reload: load, decide, sendNote };
}