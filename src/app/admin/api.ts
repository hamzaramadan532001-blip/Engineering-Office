import { apiUrl } from "@/lib/api";

export type SignupRequestStatus = "pending" | "approved" | "rejected";

export interface SignupRequestDTO {
  id: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  email: string;
  officeName: string;
  status: SignupRequestStatus;
  createdAt: number;
  decidedAt: number | null;
  note: string | null;
  notedAt: number | null;
}

export async function fetchSignupRequests(): Promise<SignupRequestDTO[]> {
  const res = await fetch(apiUrl("/api/admin/signup-requests"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error("fetch_failed");
  }
  const data = (await res.json()) as { requests: SignupRequestDTO[] };
  return data.requests;
}

export async function decideSignupRequest(
  id: string,
  status: Extract<SignupRequestStatus, "approved" | "rejected">,
): Promise<SignupRequestDTO> {
  const res = await fetch(apiUrl(`/api/admin/signup-requests/${id}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error("update_failed");
  }
  const data = (await res.json()) as { request: SignupRequestDTO };
  return data.request;
}

export async function sendSignupRequestNote(id: string, note: string): Promise<SignupRequestDTO> {
  const res = await fetch(apiUrl(`/api/admin/signup-requests/${id}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    throw new Error("update_failed");
  }
  const data = (await res.json()) as { request: SignupRequestDTO };
  return data.request;
}