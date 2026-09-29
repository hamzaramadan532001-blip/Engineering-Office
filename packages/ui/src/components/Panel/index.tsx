"use client";
import { ActionIcon } from "@mantine/core";
import clsx from "clsx";
import type React from "react";
import { useState } from "react";
import { HiChevronDown, HiChevronUp, HiOutlineInformationCircle, HiXMark } from "react-icons/hi2";
import styles from "./styles.module.scss";

export interface PanelProps {
  /** Header title (Arabic, RTL). */
  title: React.ReactNode;
  /** Optional leading icon shown before the title. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer area (e.g. a primary action button). */
  footer?: React.ReactNode;
  /** Show a collapse chevron in the header. Default true. */
  collapsible?: boolean;
  /** Start collapsed (uncontrolled). Default false. */
  defaultCollapsed?: boolean;
  /** Show the ⓘ info button; called on click. */
  onInfo?: () => void;
  /** Show the ✕ close button; called on click. */
  onClose?: () => void;
  /** Fixed panel width (number → px, or any CSS length). Default 320px. */
  width?: number | string;
  className?: string;
}

/**
 * Floating tool/layer panel — the most-reused shell in the GIS viewer.
 * White card, radius, shadow-3xl, RTL header with title + collapse/info/close.
 */
export default function Panel({
  title,
  icon,
  children,
  footer,
  collapsible = true,
  defaultCollapsed = false,
  onInfo,
  onClose,
  width = 320,
  className,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section
      className={clsx(styles.panel, className)}
      style={
        { "--panel-w": typeof width === "number" ? `${width}px` : width } as React.CSSProperties
      }
    >
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.actions}>
          {onInfo && (
            <ActionIcon variant="subtle" color="gray" onClick={onInfo} aria-label="info">
              <HiOutlineInformationCircle size={18} />
            </ActionIcon>
          )}
          {collapsible && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "expand" : "collapse"}
            >
              {collapsed ? <HiChevronUp size={18} /> : <HiChevronDown size={18} />}
            </ActionIcon>
          )}
          {onClose && (
            <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="close">
              <HiXMark size={18} />
            </ActionIcon>
          )}
        </div>
      </header>

      {!collapsed && (
        <>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </>
      )}
    </section>
  );
}
