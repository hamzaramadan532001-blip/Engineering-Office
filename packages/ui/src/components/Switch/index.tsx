import { Switch as MantineSwitch, type SwitchProps } from "@mantine/core";
import type React from "react";

/** Toggle for layer visibility and on/off options. Green by theme default. */
export default function Switch({ ...props }: SwitchProps & React.RefAttributes<HTMLInputElement>) {
  return <MantineSwitch color="green" {...props} />;
}
