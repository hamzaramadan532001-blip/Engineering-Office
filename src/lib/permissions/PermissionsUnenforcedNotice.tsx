"use client";
import styles from "./PermissionsUnenforcedNotice.module.scss";

/**
 * Permission gating is off (dev mock, or an explicit PERMISSIONS_ENFORCEMENT=off
 * deploy): everyone sees every tool and layer. The server logs it; this is the half
 * the user gets (rule 14). Persistent and click-through — never a dismissible toast.
 */
export default function PermissionsUnenforcedNotice() {
  return (
    <div className={styles.root} role="status">
      {/* <Alert variant="warning" title={PERMISSIONS_COPY.UNENFORCED_TITLE}>
        {PERMISSIONS_COPY.UNENFORCED_BODY}
      </Alert> */}
    </div>
  );
}
