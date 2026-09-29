import { Text as MantineText, type TextProps } from "@mantine/core";
export default function Text({ children, ...props }: { children: React.ReactNode } & TextProps) {
  return <MantineText {...props}>{children}</MantineText>;
}
