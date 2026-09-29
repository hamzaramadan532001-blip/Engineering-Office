import { ScrollArea as MantineScrollArea, type ScrollAreaProps } from "@mantine/core";

export default function ScrollArea({ ...props }: ScrollAreaProps) {
  return <MantineScrollArea {...props} />;
}
