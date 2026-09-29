"use client";
import clsx from "clsx";
import type React from "react";
import styles from "./styles.module.scss";

export interface MapControlRailProps {
  children: React.ReactNode;
  /** Visual theme of the rail. Dark matches the satellite/dark map shell. */
  variant?: "dark" | "light";
  className?: string;
}

/** Thin separator between control groups in the rail. */
export function MapControlRailDivider() {
  return <span className={styles.divider} aria-hidden />;
}

/**
 * Vertical map control rail (right side of the map) — a rounded floating strip
 * that wraps icon controls: basemap/brightness, search, 2D/3D, layers, home, zoom.
 * Compose with <ActionIcon/> children (or any control); use <MapControlRailDivider/>
 * to separate groups.
 */
export default function MapControlRail({
  children,
  variant = "dark",
  className,
}: MapControlRailProps) {
  return (
    <div className={clsx(styles.rail, variant === "dark" ? styles.dark : styles.light, className)}>
      {children}
    </div>
  );
}
