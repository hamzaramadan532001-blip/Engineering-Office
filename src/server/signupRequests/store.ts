import { randomUUID } from "node:crypto";

// Dev-only in-memory signup-request store, mirroring the pattern in
// `server/nafath/store.ts` (a real backend would persist this in a DB table
// alongside the SDIUSERS approval workflow). Local/mock-mode only — see the
// dev-mock branch in `app/api/auth/nafath/status/route.ts`.

export type SignupRequestStatus = "pending" | "approved" | "rejected";

export interface SignupRequest {
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

// Next.js App Router compiles each `route.ts` into its own bundle, and dev-mode
// HMR re-evaluates modules on file changes — both can otherwise produce a
// fresh copy of this module-level Map per route, so the POST that creates a
// request and the GET that lists them end up looking at different Maps. Pin
// the store on `globalThis` so every route handler shares the same instance,
// the same fix Next.js recommends for singletons like the Prisma client.
declare global {
  // eslint-disable-next-line no-var
  var __signupRequestsStore: Map<string, SignupRequest> | undefined;
}

const requests = globalThis.__signupRequestsStore ?? new Map<string, SignupRequest>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__signupRequestsStore = requests;
}

function latestFor(nationalId: string): SignupRequest | undefined {
  return [...requests.values()]
    .filter((r) => r.nationalId === nationalId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

/**
 * Creates a new pending request for this national ID, unless one already
 * exists and isn't rejected — in which case that existing request (pending
 * or approved) is reused so re-verifying with Nafath doesn't spawn
 * duplicates. A prior rejection allows a fresh resubmission.
 */
export function createSignupRequest(
  // `note`/`notedAt` are omitted alongside the other server-assigned fields: the body
  // below always initialises them to null, so a caller could never supply them.
  data: Omit<SignupRequest, "id" | "status" | "createdAt" | "decidedAt" | "note" | "notedAt">,
): SignupRequest {
  const existing = latestFor(data.nationalId);
  if (existing && existing.status !== "rejected") {
    return existing;
  }

  const request: SignupRequest = {
    ...data,
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
    decidedAt: null,
    note: null,
    notedAt: null,
  };
  requests.set(request.id, request);
  return request;
}

export function listSignupRequests(): SignupRequest[] {
  return [...requests.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getSignupRequest(id: string): SignupRequest | undefined {
  return requests.get(id);
}

export function decideSignupRequest(
  id: string,
  status: Extract<SignupRequestStatus, "approved" | "rejected">,
): SignupRequest | undefined {
  const request = requests.get(id);
  if (!request) {
    return undefined;
  }
  const updated: SignupRequest = { ...request, status, decidedAt: Date.now() };
  requests.set(id, updated);
  return updated;
}

/**
 * Attaches an admin note to a request and "sends" it to the applicant,
 * without changing the request's approve/reject status.
 */
export function addSignupRequestNote(id: string, note: string): SignupRequest | undefined {
  const request = requests.get(id);
  if (!request) {
    return undefined;
  }
  const updated: SignupRequest = { ...request, note, notedAt: Date.now() };
  requests.set(id, updated);
  return updated;
}