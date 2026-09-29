"use client";
import clsx from "clsx";
import type React from "react";
import styles from "./styles.module.scss";

export interface ToolDockItemProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** A single segment in the bottom command dock (icon + label, toggles active). */
export function ToolDockItem({
  icon,
  label,
  active = false,
  onClick,
  className,
}: ToolDockItemProps) {
  return (
    <button
      type="button"
      className={clsx(styles.item, active && styles.itemActive, className)}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemLabel}>{label}</span>
    </button>
  );
}

export interface ToolDockProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Bottom-center command dock — a floating pill bar holding ToolDockItems
 * (e.g. الأدوات / الطبقات / الإفادات). Compose with <ToolDockItem/> children.
 */
export default function ToolDock({ children, className }: ToolDockProps) {
  return (
    <div className={clsx(styles.dock, className)} role="toolbar">
      {children}
    </div>
  );
}
