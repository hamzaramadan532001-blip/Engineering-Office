import { Alert as MantineAlert, type AlertProps as MantineAlertProps } from "@mantine/core";
import type React from "react";
import styles from "./Alert.module.scss";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export type AlertProps = Omit<MantineAlertProps, "variant" | "color" | "classNames"> & {
  /** Intent, mapped to design tokens — not a Mantine palette color. */
  variant?: AlertVariant;
  children?: React.ReactNode;
};

/** Inline banner for a page-level outcome (sync failed, changes saved). */
export default function Alert({
  variant = "info",
  radius = "md",
  className,
  ...props
}: AlertProps) {
  return (
    <MantineAlert
      variant="light"
      radius={radius}
      data-variant={variant}
      className={`${styles.alert} ${className ?? ""}`.trim()}
      classNames={{ title: styles.title, icon: styles.icon, message: styles.message }}
      {...props}
    />
  );
}
