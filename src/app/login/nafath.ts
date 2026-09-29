// Frontend auth client → backend auth endpoints (configurable base; local dev-mock).
import { apiUrl } from "@/lib/api";

export type NafathStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "pendingApproval"
  | "signupRejected";

export interface SignupProfile {
  firstName: string;
  lastName: string;
  email: string;
  officeName: string;
}

export interface NafathTransaction {
  transactionId: string;
  number: string;
  expiresInSec: number;
}

interface StartResponse {
  sessionRef: string;
  random: string;
  expiresInSec: number;
}

function toTransaction(d: StartResponse): NafathTransaction {
  return { transactionId: d.sessionRef, number: d.random, expiresInSec: d.expiresInSec };
}

function mapStatus(serverStatus: string): NafathStatus {
  switch (serverStatus) {
    case "COMPLETED":
      return "approved";
    case "EXPIRED":
      return "expired";
    case "WAITING":
      return "pending";
    case "PENDING_APPROVAL":
      return "pendingApproval";
    case "SIGNUP_REJECTED":
      return "signupRejected";
    default:
      return "rejected";
  }
}

export async function initiateNafath(
  nationalId: string,
  profile?: SignupProfile,
): Promise<NafathTransaction> {
  const res = await fetch(apiUrl("/api/auth/nafath/start"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nationalId, locale: "ar", ...profile }),
  });
  if (!res.ok) {
    throw new Error("nafath_start_failed");
  }
  return toTransaction((await res.json()) as StartResponse);
}

export async function getNafathStatus(transactionId: string): Promise<NafathStatus> {
  const res = await fetch(
    apiUrl(`/api/auth/nafath/status?sessionRef=${encodeURIComponent(transactionId)}`),
    { cache: "no-store" },
  );
  if (!res.ok) {
    return "rejected";
  }
  const data = (await res.json()) as { status: string };
  return mapStatus(data.status);
}

export async function resendNafath(transactionId: string): Promise<NafathTransaction> {
  const res = await fetch(apiUrl("/api/auth/nafath/resend"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionRef: transactionId }),
  });
  if (!res.ok) {
    throw new Error("nafath_resend_failed");
  }
  return toTransaction((await res.json()) as StartResponse);
}
