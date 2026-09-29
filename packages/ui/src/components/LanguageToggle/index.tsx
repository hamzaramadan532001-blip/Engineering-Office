"use client";
import clsx from "clsx";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import styles from "./styles.module.scss";

export type Language = "ar" | "en";

export interface LanguageToggleProps {
  /** Currently active language. */
  value: Language;
  /** Called with the language to switch to. Optional while i18n is not wired. */
  onChange?: (next: Language) => void;
  className?: string;
}

/**
 * Language switch pill (DGA style). Shows the *other* language as its label.
 * Inert until `onChange` is provided (i18n is a later task).
 */
export default function LanguageToggle({ value, onChange, className }: LanguageToggleProps) {
  const next: Language = value === "ar" ? "en" : "ar";
  const label = next === "en" ? "English" : "العربية";
  return (
    <button
      type="button"
      className={clsx(styles.toggle, className)}
      onClick={() => onChange?.(next)}
      aria-label={`Switch language to ${label}`}
    >
      <span className={styles.label}>{label}</span>
      <HiOutlineGlobeAlt size={14} />
    </button>
  );
}
