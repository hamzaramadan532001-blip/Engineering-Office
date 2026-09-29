import { MultiSelect as MantineMultiSelect, type MultiSelectProps } from "@mantine/core";
import type React from "react";

/** Multi-value dropdown (dashboard filters with long option lists). */
export default function MultiSelect({
  radius = "md",
  ...props
}: MultiSelectProps & React.RefAttributes<HTMLInputElement>) {
  return <MantineMultiSelect radius={radius} {...props} />;
}
