import { randomUUID } from "node:crypto";
import { MOCK_EXPIRY_SEC } from "./config";
import type { NafathClient } from "./types";

// Dev mock of the backend Nafath behaviour: auto-approves ~6s after the first poll.
const APPROVE_AFTER_MS = 6000;
const firstPolledAt = new Map<string, number>();

function deriveNumber(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return String(10 + (h % 90)); // 10..99
}

export const mockNafathClient: NafathClient = {
  async initiate(nationalId) {
    const transId = randomUUID();
    firstPolledAt.delete(transId);
    return {
      transId,
      random: deriveNumber(`${nationalId}:${transId}`),
      expiresInSec: MOCK_EXPIRY_SEC,
    };
  },

  async getStatus({ transId, nationalId }) {
    const now = Date.now();
    if (!firstPolledAt.has(transId)) {
      firstPolledAt.set(transId, now);
    }
    const elapsed = now - (firstPolledAt.get(transId) ?? now);
    if (elapsed < APPROVE_AFTER_MS) {
      return { status: "WAITING" };
    }
    return {
      status: "COMPLETED",
      user: { nationalId, fullNameAr: "مستخدم تجريبي", fullNameEn: "Test User" },
    };
  },
};
