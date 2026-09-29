import { Select as MantineSelect, type SelectProps } from "@mantine/core";
import type React from "react";

/** Dropdown select (page setup, file format, agency, year…). */
export default function Select({
  radius = "md",
  ...props
}: SelectProps & React.RefAttributes<HTMLInputElement>) {
  return <MantineSelect radius={radius} {...props} />;
}
