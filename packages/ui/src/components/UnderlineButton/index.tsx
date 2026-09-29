import { type ButtonProps, Button as MantineButton } from "@mantine/core";
import type React from "react";
import styles from "./styles.module.scss";

export default function UnderlineButton({
  children,
  ...props
}: { children: React.ReactNode } & ButtonProps & React.DOMAttributes<HTMLButtonElement>) {
  return (
    <MantineButton className={styles.button} {...props} unstyled>
      {children}
    </MantineButton>
  );
}
