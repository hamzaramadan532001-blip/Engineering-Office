import { type DividerProps, Divider as MantineDivider } from "@mantine/core";
import type React from "react";

export default function Divider({ ...props }: DividerProps & React.DOMAttributes<HTMLDivElement>) {
  return <MantineDivider {...props} />;
}
