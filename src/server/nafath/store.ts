import { randomUUID } from "node:crypto";

// Dev-only in-memory pending-transaction store (the real backend uses Redis).
export interface PendingTx {
  sessionRef: string;
  transId: string;
  random: string;
  nationalId: string;
  locale: string;
  createdAt: number;
  // Engineering-office registration fields carried through the Nafath
  // handshake so a signup request can be created on COMPLETED — see
  // `createSignupRequest` in `server/signupRequests/store.ts`. Optional
  // because a returning (already-approved) user re-verifying via the same
  // login form doesn't need to resend them.
  firstName?: string;
  lastName?: string;
  email?: string;
  officeName?: string;
  // Set once the first COMPLETED poll creates/looks up a signup request, so
  // every later poll on this same sessionRef re-checks that exact request
  // instead of calling createSignupRequest() again (which would otherwise
  // treat a just-rejected request as stale and silently spin up a new
  // "pending" one on the very next poll).
  signupRequestId?: string;
}

const transactions = new Map<string, PendingTx>();

export function createPendingTx(data: Omit<PendingTx, "sessionRef" | "createdAt">): PendingTx {
  const tx: PendingTx = { ...data, sessionRef: randomUUID(), createdAt: Date.now() };
  transactions.set(tx.sessionRef, tx);
  return tx;
}

export function getPendingTx(sessionRef: string): PendingTx | undefined {
  return transactions.get(sessionRef);
}

export function updatePendingTx(sessionRef: string, patch: Partial<PendingTx>): void {
  const tx = transactions.get(sessionRef);
  if (tx) {
    transactions.set(sessionRef, { ...tx, ...patch });
  }
}

export function deletePendingTx(sessionRef: string): void {
  transactions.delete(sessionRef);
}
