"use client";

import { type ReactNode, useCallback, useEffect, useSyncExternalStore } from "react";
import { cancelPermissionsLoad, loadPermissions } from "./load";
import PermissionsErrorNotice from "./PermissionsErrorNotice";
import PermissionsUnenforcedNotice from "./PermissionsUnenforcedNotice";
import { permissionsStore } from "./store";
import type { UserPermissions } from "./types";

interface PermissionsProviderProps {
  children: ReactNode;
  /**
   * Grants already in hand (the `{user, permissions}` session payload). Omit it and
   * the provider fetches `/api/auth/session` itself.
   */
  initialPermissions?: UserPermissions | null;
}

/**
 * Owns the permission lifecycle: hydrate (or fetch) on mount, re-fetch on window
 * focus, and render the notices. The grants themselves live in the module store, which
 * `usePermissions` and the non-React readers (the layer catalog) both read directly.
 */
export function PermissionsProvider({ children, initialPermissions }: PermissionsProviderProps) {
  const snapshot = useSyncExternalStore(
    permissionsStore.subscribe,
    permissionsStore.getSnapshot,
    permissionsStore.getServerSnapshot,
  );

  useEffect(() => {
    if (initialPermissions) {
      permissionsStore.setPermissions(initialPermissions, true);
      return;
    }
    void loadPermissions();
    return cancelPermissionsLoad;
  }, [initialPermissions]);

  useEffect(() => {
    const refresh = () => {
      void loadPermissions();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const retry = useCallback(() => {
    void loadPermissions();
  }, []);

  return (
    <>
      {children}
      {!snapshot.enforced && <PermissionsUnenforcedNotice />}
      {snapshot.status === "error" && snapshot.error && (
        <PermissionsErrorNotice code={snapshot.error} onRetry={retry} />
      )}
    </>
  );
}
