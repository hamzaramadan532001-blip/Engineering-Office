import { type CheckboxProps, Checkbox as MantineCheckbox } from "@mantine/core";
import type React from "react";

/**
 * Checkbox for selection lists (attestation items, layer leaves). Green by default,
 * with a pointer cursor over both the box and its label (Mantine leaves the label as
 * a text cursor otherwise).
 */
export default function Checkbox({
  ...props
}: CheckboxProps & React.RefAttributes<HTMLInputElement>) {
  return (
    <MantineCheckbox
      color="green"
      styles={{ input: { cursor: "pointer" }, label: { cursor: "pointer" } }}
      {...props}
    />
  );
}
