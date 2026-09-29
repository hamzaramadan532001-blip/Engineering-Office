import { type ActionIconProps, ActionIcon as MantineActionIcon } from "@mantine/core";
import clsx from "clsx";
import type React from "react";
import styles from "./styles.module.scss";

export default function ActionIcon({
  children,
  p = ".25em",
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & ActionIconProps &
  React.DOMAttributes<HTMLButtonElement>) {
  return (
    <MantineActionIcon p={p} className={clsx(styles.actionIcon, className)} {...props}>
      {children}
    </MantineActionIcon>
  );
}
