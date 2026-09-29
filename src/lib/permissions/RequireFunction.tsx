"use client";

import { Tooltip } from "@makkah-municipality-gis/ui";
import type { ReactNode } from "react";
import styles from "./RequireFunction.module.scss";
import { usePermissions } from "./usePermissions";

type RequireFunctionProps = {
  /** FUNCTIONS.FUNCTIONNAME the wrapped UI requires. */
  fn: string;
  children: ReactNode;
} & (
  | { mode?: "hide"; disabledTooltipAr?: never }
  /** The tooltip is the only explanation the user gets — required, hence the union. */
  | { mode: "disable"; disabledTooltipAr: string }
);

/**
 * Gate for a capability. Denied AND loading both fail closed: nothing renders in
 * "hide" mode, and "disable" mode shows the control inert with its Arabic reason.
 * Frontend gating is UX only — the API re-enforces every action.
 */
export function RequireFunction({
  fn,
  mode = "hide",
  disabledTooltipAr,
  children,
}: RequireFunctionProps) {
  const { loading, can } = usePermissions();
  const allowed = !loading && can(fn);

  if (allowed) {
    return <>{children}</>;
  }
  if (mode === "hide") {
    return null;
  }

  return (
    <Tooltip label={disabledTooltipAr} withArrow>
      {/* fieldset[disabled] really disables the controls inside; data-no-drag keeps the
          wrapper from starting a Dragable panel drag (rule 6). */}
      <fieldset
        disabled
        data-no-drag
        aria-disabled="true"
        aria-label={disabledTooltipAr}
        className={styles.disabled}
      >
        <span className={styles.inert}>{children}</span>
      </fieldset>
    </Tooltip>
  );
}
