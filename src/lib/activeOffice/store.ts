"use client";
import { apiUrl } from "@/lib/api";

/**
 * The engineering office the signed-in session belongs to.
 *
 * Kept here in `src/lib` because it is cross-feature by nature: the login screen writes it,
 * and the map, the requests screen and anything else that needs "who is this request for"
 * will read it. Same `{ subscribe, getSnapshot, getServerSnapshot }` shape as the other
 * stores, so React reads it with `useSyncExternalStore`.
 *
 * The SERVER is the source of truth (the sealed session cookie plus a live read of the
 * register). This store is a client-side cache of that, so a page reload does not leave the
 * UI thinking nobody is signed in: call `hydrateActiveOffice()` once on mount and it refills
 * itself from `GET /api/auth/office`.
 */

export type OfficeLicences = {
  construction: string | null;
  constructionSupervision: string | null;
  groupHousing: string | null;
  commercial: string | null;
  excavationSupervision: string | null;
};

export type ActiveOffice = {
  objectId: number;
  officeId: number | null;
  /** اسم المكتب الهندسي — the name shown in the greeting. */
  name: string;
  /** الرقم الوطني used to sign in. */
  nationalNumber: string;
  email: string | null;
  contactNumber: string | null;
  licences: OfficeLicences;
};

const listeners = new Set<() => void>();
let state: ActiveOffice | null = null;
/** So a reload only asks the server once, however many components mount at the same time. */
let hydration: Promise<ActiveOffice | null> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function setActive(office: ActiveOffice) {
  state = office;
  hydration = Promise.resolve(office);
  emit();
}

function clear() {
  state = null;
  hydration = null;
  if (state === null) emit();
}

/**
 * Refills the store from the session, once per page load.
 *
 * Resolves to `null` when the session is not an office login (a Nafath session, or none) —
 * that is a normal state, not an error, so it never throws.
 */
async function hydrate(): Promise<ActiveOffice | null> {
  if (state) return state;
  if (hydration) return hydration;

  hydration = (async () => {
    try {
      const response = await fetch(apiUrl("/api/auth/office"), { cache: "no-store" });
      if (!response.ok) return null;

      const payload = (await response.json()) as { office?: ActiveOffice };
      if (!payload.office) return null;

      state = payload.office;
      emit();
      return state;
    } catch (error) {
      console.error("[auth] failed to hydrate the active office:", error);
      return null;
    }
  })();

  return hydration;
}

export const activeOfficeStore = {
  subscribe,
  getSnapshot: (): ActiveOffice | null => state,
  getServerSnapshot: (): ActiveOffice | null => null,
  setActive,
  clear,
  hydrate,
};
