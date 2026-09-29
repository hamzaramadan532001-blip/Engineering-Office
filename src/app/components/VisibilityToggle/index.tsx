"use client";

import { HiEye, HiEyeSlash } from "react-icons/hi2";
import styles from "./VisibilityToggle.module.scss";

export interface VisibilityToggleProps {
  /** Whether the target is currently drawn on the map. */
  visible: boolean;
  /** Flip visibility. The caller owns the actual map mutation — this control is UI only. */
  onToggle: () => void;
  disabled?: boolean;
  /** Accessible/tooltip label when the target is hidden (action = show). */
  labelShow?: string;
  /** Accessible/tooltip label when the target is visible (action = hide). */
  labelHide?: string;
  /** Icon size in px. */
  size?: number;
}

/**
 * Shared show/hide control — the eye toggle reused by the Layers List (الطبقات الفاعلة) and the
 * Imagery catalogue (المصورات). Presentation only: it renders the visible/hidden eye state and
 * calls `onToggle`; the layer-visibility logic lives in each tool's store (per CLAUDE.md —
 * components are presentation; data/behaviour lives in the hook/store layer).
 */
export default function VisibilityToggle({
  visible,
  onToggle,
  disabled,
  labelShow = "إظهار",
  labelHide = "إخفاء",
  size = 16,
}: VisibilityToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-visible={visible || undefined}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={visible}
      title={visible ? labelHide : labelShow}
    >
      {visible ? <HiEye size={size} /> : <HiEyeSlash size={size} />}
    </button>
  );
}
