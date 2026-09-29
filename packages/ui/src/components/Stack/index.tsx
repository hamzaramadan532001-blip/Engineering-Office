import { Stack as MantineStack, type StackProps } from "@mantine/core";

export default function Stack({ children, ...props }: { children: React.ReactNode } & StackProps) {
  return <MantineStack {...props}>{children}</MantineStack>;
}
