import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import styles from "./SearchInput.module.scss";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Override for bilingual apps; defaults to Arabic. */
  clearLabel?: string;
  /** Field height: "sm" (32px) for dense toolbars, "md" (36px) elsewhere. */
  size?: "sm" | "md";
}

/**
 * Compact, RTL-aware search field.
 * Shows a search icon and a clear button when the user has typed text.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "بحث...",
  className,
  ariaLabel = "بحث",
  clearLabel = "مسح البحث",
  size = "md",
}: SearchInputProps) {
  return (
    <div className={`${styles.wrapper} ${className ?? ""}`.trim()}>
      <span className={styles.icon} aria-hidden>
        <HiMagnifyingGlass size={16} />
      </span>
      <input
        type="text"
        className={styles.input}
        data-size={size}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange("")}
          aria-label={clearLabel}
        >
          <HiXMark size={14} />
        </button>
      )}
    </div>
  );
}
