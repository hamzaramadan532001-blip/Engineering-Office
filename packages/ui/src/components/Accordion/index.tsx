import { Accordion as MantineAccordion } from "@mantine/core";
import type React from "react";
import styles from "./Accordion.module.scss";

export interface AccordionItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

/** `value`/`onChange` widen to `string[]` when `multiple` is set, as in Mantine. */
export type AccordionValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string | null;

export interface AccordionProps<Multiple extends boolean = false> {
  items: AccordionItem[];
  multiple?: Multiple;
  value?: AccordionValue<Multiple>;
  defaultValue?: AccordionValue<Multiple>;
  onChange?: (value: AccordionValue<Multiple>) => void;
  className?: string;
}

/** Collapsible sections driven by data (role permissions, layer groups). */
export default function Accordion<Multiple extends boolean = false>({
  items,
  className,
  ...props
}: AccordionProps<Multiple>) {
  return (
    <MantineAccordion
      className={className}
      classNames={{ item: styles.item, control: styles.control, panel: styles.panel }}
      {...props}
    >
      {items.map((item) => (
        <MantineAccordion.Item key={item.value} value={item.value}>
          <MantineAccordion.Control>{item.label}</MantineAccordion.Control>
          <MantineAccordion.Panel>{item.content}</MantineAccordion.Panel>
        </MantineAccordion.Item>
      ))}
    </MantineAccordion>
  );
}
