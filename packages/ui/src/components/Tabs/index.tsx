import { Tabs as MantineTabs } from "@mantine/core";
import type React from "react";
import styles from "./Tabs.module.scss";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Panel body for the given tab. Called once per tab in `tabs`. */
  renderPanel: (value: string) => React.ReactNode;
  /** Keep inactive panels in the DOM. Off by default so data hooks unmount. */
  keepMounted?: boolean;
  className?: string;
}

/**
 * Underline tabs driven by data rather than children, so a screen declares its
 * sections in one array. Roles/keyboard handling come from Mantine.
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  renderPanel,
  keepMounted = false,
  className,
}: TabsProps) {
  return (
    <MantineTabs
      value={value}
      onChange={onChange}
      keepMounted={keepMounted}
      className={className}
      classNames={{ list: styles.list, tab: styles.tab, panel: styles.panel }}
    >
      <MantineTabs.List>
        {tabs.map((tab) => (
          <MantineTabs.Tab
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            leftSection={tab.icon}
          >
            {tab.label}
          </MantineTabs.Tab>
        ))}
      </MantineTabs.List>
      {tabs.map((tab) => (
        <MantineTabs.Panel key={tab.value} value={tab.value}>
          {renderPanel(tab.value)}
        </MantineTabs.Panel>
      ))}
    </MantineTabs>
  );
}
