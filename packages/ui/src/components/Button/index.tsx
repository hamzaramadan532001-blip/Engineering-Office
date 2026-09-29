import { type ButtonProps, Button as MantineButton } from "@mantine/core";
import type React from "react";
import styles from "./button.module.scss";

type CommonProps = { children: React.ReactNode } & ButtonProps;

type NativeButtonProps = CommonProps &
  React.DOMAttributes<HTMLButtonElement> & {
    component?: never;
    href?: never;
    /** Native button type — needed for form submit buttons. */
    type?: "button" | "submit" | "reset";
  };

type LinkButtonProps = CommonProps &
  React.DOMAttributes<HTMLAnchorElement> & {
    /** Render as an anchor so a navigation stays a real link, not a click handler. */
    component: "a";
    href: string;
  };

export type ButtonComponentProps = NativeButtonProps | LinkButtonProps;

export default function Button({ children, ...props }: ButtonComponentProps) {
  // Mantine's polymorphic props are a per-element union a spread cannot narrow.
  // The signature above is what keeps call sites type-safe.
  const polymorphic = props as React.ComponentProps<typeof MantineButton>;

  return (
    <MantineButton className={styles.button} {...polymorphic}>
      {children}
    </MantineButton>
  );
}
