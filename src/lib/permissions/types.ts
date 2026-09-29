/** Mirrors the permissions-api ResolvedPermissions (PERM-11), as served by the BFF. */
export interface UserPermissions {
  roles: string[];
  isAdministrator: boolean;
  functions: { functionName: string; functionNameAr: string | null }[];
  mapLayers: { mapServiceLayerName: string; mapServiceUrl: string }[];
}

/** Lifecycle of the session permission load. Anything but "ready" denies (fail closed). */
export type PermissionsStatus = "loading" | "ready" | "error";

/** Why a load failed — branched on as a union, never sniffed from a message (rule 15). */
export type PermissionsErrorCode = "network" | "unauthenticated" | "upstream";

export interface PermissionsSnapshot {
  status: PermissionsStatus;
  permissions: UserPermissions | null;
  error: PermissionsErrorCode | null;
  /**
   * False when the server serves no grants at all — the dev mock, or an explicit
   * PERMISSIONS_ENFORCEMENT=off deploy. Gating is then off (and the user is told)
   * rather than hiding the whole UI.
   */
  enforced: boolean;
}

/** The `GET /api/auth/session` envelope (see app/api/auth/session/route.ts). */
export interface SessionPayload {
  authenticated: boolean;
  guest?: boolean;
  mock?: boolean;
  /** "off" ⇒ the server enforces nothing; absent is read as "on" (fail closed). */
  enforcement?: "on" | "off";
  isAdministrator?: boolean;
  roles?: string[];
  functions?: UserPermissions["functions"];
  mapLayers?: UserPermissions["mapLayers"];
}

export type PermissionsLoadResult =
  | { ok: true; permissions: UserPermissions; enforced: boolean }
  | { ok: false; code: PermissionsErrorCode };
