import { useCallback, useEffect, useReducer } from "react";
import { getNafathStatus, type NafathStatus, resendNafath } from "../nafath";

const POLL_MS = 2000;

interface State {
  txId: string;
  number: string;
  status: NafathStatus;
  secondsLeft: number;
  resending: boolean;
}

type Action =
  | { type: "tick" }
  | {
      type: "settled";
      status: Extract<NafathStatus, "approved" | "rejected" | "pendingApproval" | "signupRejected">;
    }
  | { type: "resend/start" }
  | { type: "resend/done"; txId: string; number: string; secondsLeft: number }
  | { type: "resend/error" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "tick": {
      if (state.status !== "pending") {
        return state;
      }
      if (state.secondsLeft <= 1) {
        return { ...state, secondsLeft: 0, status: "expired" };
      }
      return { ...state, secondsLeft: state.secondsLeft - 1 };
    }
    case "settled":
      return { ...state, status: action.status };
    case "resend/start":
      return { ...state, resending: true };
    case "resend/done":
      return {
        txId: action.txId,
        number: action.number,
        secondsLeft: action.secondsLeft,
        status: "pending",
        resending: false,
      };
    case "resend/error":
      return { ...state, resending: false };
    default:
      return state;
  }
}

function formatCountdown(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface NafathVerification {
  number: string;
  status: NafathStatus;
  countdown: string;
  canResend: boolean;
  resending: boolean;
  resend: () => void;
}

export function useNafathVerification(params: {
  transactionId: string;
  initialNumber: string;
  expiresInSec: number;
  onApproved: () => void;
}): NafathVerification {
  const { transactionId, initialNumber, expiresInSec, onApproved } = params;

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    txId: transactionId,
    number: initialNumber,
    status: "pending" as NafathStatus,
    secondsLeft: expiresInSec,
    resending: false,
  }));
  const { txId, status } = state;

  // External: poll the backend until the request settles. Keeps polling
  // through "pendingApproval" (not just "pending") so a request approved on
  // /admin while this tab is still open gets picked up without the person
  // having to restart the Nafath flow.
  useEffect(() => {
    if (
      status === "approved" ||
      status === "rejected" ||
      status === "expired" ||
      status === "signupRejected"
    ) {
      return;
    }
    let cancelled = false;
    const id = setInterval(async () => {
      const next = await getNafathStatus(txId);
      if (cancelled) {
        return;
      }
      if (next === "approved") {
        dispatch({ type: "settled", status: "approved" });
        onApproved();
      } else if (next === "rejected" || next === "signupRejected") {
        dispatch({ type: "settled", status: next });
      } else if (next === "pendingApproval") {
        dispatch({ type: "settled", status: "pendingApproval" });
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [txId, status, onApproved]);

  // External: 1s validity countdown.
  useEffect(() => {
    if (status !== "pending") {
      return;
    }
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [status]);

  const resend = useCallback(async () => {
    dispatch({ type: "resend/start" });
    try {
      const tx = await resendNafath(txId);
      dispatch({
        type: "resend/done",
        txId: tx.transactionId,
        number: tx.number,
        secondsLeft: tx.expiresInSec,
      });
    } catch {
      dispatch({ type: "resend/error" });
    }
  }, [txId]);

  return {
    number: state.number,
    status,
    countdown: formatCountdown(state.secondsLeft),
    canResend: (status === "expired" || status === "rejected") && !state.resending,
    resending: state.resending,
    resend,
  };
}
