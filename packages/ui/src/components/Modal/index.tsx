"use client";
import { Modal as MantineModal, type ModalProps } from "@mantine/core";

/**
 * App modal — a thin wrapper over Mantine v9 `Modal` (design-system rule #11:
 * wrap Mantine, never hand-roll primitives). Defaults match the Figma overlay:
 * a centered card over a dimmed + blurred backdrop. RTL is inherited from the
 * global `DirectionProvider`. Pass `withCloseButton={false}` and compose a
 * custom header inside `children` when the design has no visible ✕.
 */
export default function Modal({
  centered = true,
  radius = "lg",
  overlayProps,
  ...props
}: ModalProps) {
  return (
    <MantineModal
      centered={centered}
      radius={radius}
      overlayProps={{ backgroundOpacity: 0.4, blur: 5, ...overlayProps }}
      {...props}
    />
  );
}
