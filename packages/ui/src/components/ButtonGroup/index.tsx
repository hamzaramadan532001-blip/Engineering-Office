import { type ButtonGroupProps, ButtonGroup as MantineButtonGroup } from "@mantine/core";

export default function ButtonGroup({
  children,
  ...props
}: { children: React.ReactNode } & ButtonGroupProps) {
  return <MantineButtonGroup {...props}>{children}</MantineButtonGroup>;
}
