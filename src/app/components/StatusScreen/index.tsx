import { Logo } from "@makkah-municipality-gis/ui";
import clsx from "clsx";
import type { ReactNode } from "react";
import { ERROR_REFERENCE_LABEL, STATUS_COPY, type StatusCode } from "./constants";
import styles from "./StatusScreen.module.scss";

export interface StatusScreenProps {
  code: StatusCode;
  /** Action controls (link/button) rendered under the message. */
  children: ReactNode;
  /** `error.digest` — the id a user quotes to support so we can find the server log. */
  reference?: string;
}

export default function StatusScreen({ code, children, reference }: StatusScreenProps) {
  const { label, title, message, tone, icon: Icon } = STATUS_COPY[code];

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Logo width={200} className={styles.logo} />

        <span className={clsx(styles.badge, styles[tone])} aria-hidden>
          <Icon size={28} />
        </span>

        <p className={styles.code}>{label}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>

        {reference ? (
          <p className={styles.reference}>
            {ERROR_REFERENCE_LABEL}: <code>{reference}</code>
          </p>
        ) : null}

        <div className={styles.actions}>{children}</div>
      </section>
    </main>
  );
}
