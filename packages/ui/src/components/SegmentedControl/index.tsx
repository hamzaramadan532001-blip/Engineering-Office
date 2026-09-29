import {
  SegmentedControl as MantineSegmentedControl,
  type SegmentedControlProps,
} from "@mantine/core";

/**
 * Pill segmented control for filter chips (week/month/quarter/year, type, status).
 * Defaults to the green theme color and a pill radius to match the dashboards.
 */
export default function SegmentedControl({
  color = "green",
  radius = "xl",
  ...props
}: SegmentedControlProps) {
  return <MantineSegmentedControl color={color} radius={radius} {...props} />;
}
