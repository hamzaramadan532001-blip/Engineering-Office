import { Badge as MantineBadge, type BadgeProps as MantineBadgeProps } from "@mantine/core";
import styles from "./Badge.module.scss";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export type BadgeProps = Omit<MantineBadgeProps, "variant" | "color" | "size"> & {
  /** Intent, mapped to design tokens — not a Mantine palette color. */
  variant?: BadgeVariant;
  size?: "sm" | "md";
};

/** Status pill (permit state, role count, sync result). Token-coloured by intent. */
export default function Badge({
  variant = "neutral",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <MantineBadge
      variant="default"
      data-variant={variant}
      data-size={size}
      className={`${styles.badge} ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
