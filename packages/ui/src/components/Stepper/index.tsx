import { Stepper as MantineStepper, type StepperProps as MantineStepperProps } from "@mantine/core";
import type React from "react";
import styles from "./styles.module.scss";

export type Step = {
  /** Stable identifier for the step. */
  id: string;
  /** Label shown under the step indicator (Arabic-first). */
  label: React.ReactNode;
};

export type StepperProps = {
  /** Ordered list of steps. */
  steps: readonly Step[];
  /** The id of the currently active step. */
  activeStep: string;
  /** Called when the user clicks a completed or allowed step. */
  onStepClick?: (id: string) => void;
  /** Mantine theme color for active/completed states. Defaults to the theme primary (green). */
  color?: MantineStepperProps["color"];
  /** Visual size of the indicator and label. */
  size?: MantineStepperProps["size"];
};

/**
 * RTL-aware wizard stepper built on Mantine's Stepper.
 *
 * Stacking variant used in the attestation wizard: indicator on top, label below,
 * connector line between indicators. Use any place a multi-step flow needs a
 * consistent progress header.
 */
export default function Stepper({
  steps,
  activeStep,
  onStepClick,
  color,
  size = "sm",
}: StepperProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeStep);

  return (
    <MantineStepper
      active={activeIndex}
      onStepClick={(index) => onStepClick?.(steps[index].id)}
      color={color}
      size={size}
      iconPosition="left"
      allowNextStepsSelect={false}
      classNames={{
        root: styles.root,
        steps: styles.steps,
        step: styles.step,
        stepWrapper: styles.stepWrapper,
        stepIcon: styles.stepIcon,
        stepCompletedIcon: styles.stepCompletedIcon,
        stepBody: styles.stepBody,
        stepLabel: styles.stepLabel,
        separator: styles.separator,
      }}
    >
      {steps.map((step) => (
        <MantineStepper.Step key={step.id} label={step.label} />
      ))}
    </MantineStepper>
  );
}
