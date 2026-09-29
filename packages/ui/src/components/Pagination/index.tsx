import {
  Pagination as MantinePagination,
  type PaginationProps as MantinePaginationProps,
} from "@mantine/core";
import styles from "./Pagination.module.scss";

export type PaginationProps = Omit<MantinePaginationProps, "color">;

/**
 * Page control for the admin tables. Mantine mirrors the next/previous chevrons
 * from `[dir]`, so RTL needs no extra handling here.
 */
export default function Pagination({
  siblings = 1,
  boundaries = 1,
  radius = "md",
  className,
  ...props
}: PaginationProps) {
  return (
    <MantinePagination
      siblings={siblings}
      boundaries={boundaries}
      radius={radius}
      className={className}
      classNames={{ control: styles.control, dots: styles.dots }}
      {...props}
    />
  );
}
