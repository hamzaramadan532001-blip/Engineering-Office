import { type BoxProps, Box as MantineBox } from "@mantine/core";

export default function Box({
  children,
  slot,
  ...props
}: {
  children: React.ReactNode;
  slot?: string;
} & BoxProps) {
  return (
    <MantineBox bg="var(--surface-panel)" p="xs" bdrs="sm" className="map-box" {...props}>
      {children}
    </MantineBox>
  );
}
