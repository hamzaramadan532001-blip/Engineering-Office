"use client";

import { Alert, Button } from "@makkah-municipality-gis/ui";
import { PERMISSIONS_COPY, PERMISSIONS_ERROR_DETAIL } from "./copy";
import styles from "./PermissionsErrorNotice.module.scss";
import type { PermissionsErrorCode } from "./types";

/**
 * Failing to load permissions hides every gated widget and layer — a degraded
 * outcome the user must see, not just a console line (rule 14).
 */
export default function PermissionsErrorNotice({
  code,
  onRetry,
}: {
  code: PermissionsErrorCode;
  onRetry: () => void;
}) {
  return (
    <div className={styles.root} role="status">
      <Alert variant="warning" title={PERMISSIONS_COPY.ERROR_TITLE}>
        <div className={styles.body}>
          <span>{`${PERMISSIONS_ERROR_DETAIL[code]} ${PERMISSIONS_COPY.ERROR_HINT}`}</span>
          <Button size="xs" variant="outline" onClick={onRetry}>
            {PERMISSIONS_COPY.ERROR_RETRY}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
