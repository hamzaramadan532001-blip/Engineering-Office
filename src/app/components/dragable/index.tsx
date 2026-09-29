"use client";

import { useState } from "react";
import { Rnd } from "react-rnd";

/** Where the first panel appears: top-left, just under the top bar. */
const INITIAL = { x: 16, y: 88 };

/**
 * Grid spacing for simultaneously-open panels, so each new one lands clearly beside the
 * previous one (not stacked on top of it) on first open. The user can still drag each panel
 * anywhere afterwards — this only controls where it first appears.
 */
const STEP_X = 360;
const STEP_Y = 280;

/** Below this width the side-by-side grid can't fit; panels cascade downward instead. */
const MOBILE_MAX_WIDTH = 768;
const MOBILE_STEP_Y = 48;

/**
 * Controls that must NOT start a panel drag, even though they live inside the draggable panel.
 *
 * Without this, a mousedown on the opacity slider (or any button) is read as "grab the panel",
 * so the panel moves instead of the control responding. react-rnd forwards this selector to
 * react-draggable, which walks up from the event target to the panel root and cancels the drag
 * if any ancestor matches. We exclude interactive elements by default and expose a `data-no-drag`
 * hook for anything the generic selectors miss (e.g. a slider track that is a plain `<div>`).
 *
 * We use `cancel` (opt-out) rather than `dragHandleClassName` (opt-in to a header handle) on
 * purpose: there is no shared panel header, and several panels have no header at all — making
 * the header the only handle would leave those panels undraggable.
 */
const NON_DRAGGABLE =
  "[data-no-drag], button, a, input, textarea, select, [role='slider'], [role='button']";

interface DragableProps {
  children: React.ReactNode;
  /**
   * Stacking order among the panels currently open (e.g. its position in the `openSubTools`
   * array). Lays out the *initial* drop position — it's read once on mount (react-rnd's
   * `default` is uncontrolled), so it never fights the user once they've dragged a panel
   * themselves. Defaults to 0 (the original single-panel position).
   */
  index?: number;
}

/**
 * Minimal draggable wrapper — turns its child into a draggable element and nothing more.
 *
 * It adds NO background, padding, border, radius or fixed size: it adapts to the child's
 * own width/height (CSS `auto`), so each panel fully owns its size and appearance.
 */
export default function Dragable({ children, index = 0 }: DragableProps) {
  // Computed lazily once per mount: react-rnd ignores `default` after that, and
  // `bounds="parent"` only constrains drags, not this initial position.
  const [position] = useState(() => {
    if (window.innerWidth < MOBILE_MAX_WIDTH) {
      // No room for columns on a phone — cascade downward so every panel stays grabbable.
      return { x: 2, y: INITIAL.y + index * MOBILE_STEP_Y };
    }
    // Wrap the grid to however many columns actually fit, so a late-opened panel
    // never spawns beyond the right edge of the viewport.
    const columns = Math.max(1, Math.floor((window.innerWidth - INITIAL.x) / STEP_X));
    const col = index % columns;
    const row = Math.floor(index / columns);
    return { x: INITIAL.x + col * STEP_X, y: INITIAL.y + row * STEP_Y };
  });

  return (
    <Rnd
      bounds="parent"
      enableResizing={false}
      cancel={NON_DRAGGABLE}
      default={{ ...position, width: "auto", height: "auto" }}
    >
      {children}
    </Rnd>
  );
}
