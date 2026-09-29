import {
  Textarea as MantineTextarea,
  type TextareaProps as MantineTextareaProps,
} from "@mantine/core";
import styles from "./styles.module.scss";

export type TextareaProps = MantineTextareaProps;

export default function Textarea({ classNames, ...props }: TextareaProps) {
  return (
    <MantineTextarea
      classNames={
        typeof classNames === "object"
          ? { input: styles.input, label: styles.label, ...classNames }
          : { input: styles.input, label: styles.label }
      }
      {...props}
    />
  );
}
