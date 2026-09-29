"use client";

import { HiHeart, HiOutlineHeart } from "react-icons/hi2";
import styles from "./FavoriteToggle.module.scss";

export interface FavoriteToggleProps {
  /** Whether this item is currently favorited. */
  active: boolean;
  /** Flip favorite state. The caller owns persistence — this control is UI only. */
  onToggle: () => void;
  disabled?: boolean;
  /** Accessible/tooltip label when not favorited (action = add). */
  labelAdd?: string;
  /** Accessible/tooltip label when favorited (action = remove). */
  labelRemove?: string;
  /** Icon size in px. */
  size?: number;
}

/**
 * Shared favorite (love) control — reused by the Layers List (الطبقات الفاعلة) and the
 * Imagery catalogue (المصورات). Presentation only: renders a heart that fills red when
 * active and calls `onToggle`; persistence lives in the favorites store (useFavorites).
 * Mirrors VisibilityToggle so the two row controls read as a matched set.
 */
export default function FavoriteToggle({
  active,
  onToggle,
  disabled,
  labelAdd = "إضافة إلى المفضلة",
  labelRemove = "إزالة من المفضلة",
  size = 16,
}: FavoriteToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-active={active || undefined}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      title={active ? labelRemove : labelAdd}
    >
      {active ? <HiHeart size={size} /> : <HiOutlineHeart size={size} />}
    </button>
  );
}
