import { Radio as MantineRadio, type RadioGroupProps, type RadioProps } from "@mantine/core";
import type React from "react";

export type { RadioGroupProps, RadioProps };

/**
 * Single-choice input. Green by theme default, pointer cursor over the dot and
 * its label, and `description` renders under the label for per-option help.
 */
function Radio({ ...props }: RadioProps & React.RefAttributes<HTMLInputElement>) {
  return (
    <MantineRadio
      color="green"
      styles={{ radio: { cursor: "pointer" }, label: { cursor: "pointer" } }}
      {...props}
    />
  );
}

// Keeps the compound API: `<Radio.Group>` wraps the options and owns the value.
Radio.Group = MantineRadio.Group;

export default Radio;
