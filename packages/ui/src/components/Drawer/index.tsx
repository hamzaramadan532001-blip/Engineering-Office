import { Drawer as MantineDrawer, type DrawerProps as MantineDrawerProps } from "@mantine/core";
import type React from "react";
import styles from "./Drawer.module.scss";

export type DrawerProps = Omit<MantineDrawerProps, "position"> & {
  /** Logical edge: "end" is the left in RTL, the right in LTR. */
  side?: "start" | "end";
  /** Pinned below the scrolling body — action bars, save/cancel. */
  footer?: React.ReactNode;
};

// Mantine places the panel with `justify-content` on the inner wrapper, which
// already resolves against the inherited `direction` — so "left"/"right" behave
// as logical start/end and must not be flipped again here.
const POSITION = { start: "left", end: "right" } as const;

/** Slide-over panel for edit forms that are too large for a modal. */
export default function Drawer({
  side = "end",
  footer,
  children,
  radius = "md",
  ...props
}: DrawerProps) {
  return (
    <MantineDrawer
      position={POSITION[side]}
      radius={radius}
      classNames={{ body: styles.body }}
      {...props}
    >
      <div className={styles.content}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </MantineDrawer>
  );
}
