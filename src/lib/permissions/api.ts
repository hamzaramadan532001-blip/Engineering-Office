/**
 * Data/transport for the session permissions — talks to our BFF (`/api/auth/session`),
 * which fetches `/permissions/me` (or `/permissions/public` for a guest) server-side.
 * No React, no JSX.
 */
import { apiFetch } from "@/lib/api";
import type { PermissionsLoadResult, SessionPayload, UserPermissions } from "./types";

const SESSION_PATH = "/api/auth/session";

function toPermissions(payload: SessionPayload): UserPermissions {
  return {
    roles: payload.roles ?? [],
    isAdministrator: payload.isAdministrator ?? false,
    functions: payload.functions ?? [],
    mapLayers: payload.mapLayers ?? [],
  };
}

/** Load the session's grants. Never throws — the outcome is a typed union (rule 15). */
export async function fetchSessionPermissions(
  signal?: AbortSignal,
): Promise<PermissionsLoadResult> {
  let res: Response;
  try {
    res = await apiFetch(SESSION_PATH, { signal, cache: "no-store" });
  } catch {
    return { ok: false, code: "network" };
  }

  if (res.status === 401) {
    return { ok: false, code: "unauthenticated" };
  }
  if (!res.ok) {
    return { ok: false, code: "upstream" };
  }

  let payload: SessionPayload;
  try {
    payload = (await res.json()) as SessionPayload;
  } catch {
    return { ok: false, code: "upstream" };
  }

  // The server says whether it enforces anything: "off" is the dev mock or an explicit
  // PERMISSIONS_ENFORCEMENT=off deploy, both of which answer with empty grants that would
  // otherwise blank every gated widget. Anything but "off" enforces (fail closed).
  return {
    ok: true,
    permissions: toPermissions(payload),
    enforced: payload.enforcement !== "off",
  };
}
