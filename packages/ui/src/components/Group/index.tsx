import { type GroupProps, Group as MantineGroup } from "@mantine/core";

export default function Group({ children, ...props }: { children: React.ReactNode } & GroupProps) {
  return <MantineGroup {...props}>{children}</MantineGroup>;
}
