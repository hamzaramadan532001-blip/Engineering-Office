import { TextInput, type TextInputProps } from "@mantine/core";
import clsx from "clsx";
import styles from "./styles.module.scss";

export type InputProps = TextInputProps & {
  label: string;
  placeholder: string;
  /** Field height: "md" (48px, the DGA form spec) or "sm" (36px) for dense
   *  toolbars, where the field sits beside 36px buttons and search inputs. */
  fieldSize?: "sm" | "md";
};

export default function Input({ classNames, fieldSize = "md", ...props }: InputProps) {
  const own = {
    input: clsx(styles.input, fieldSize === "sm" && styles.inputSm),
    label: styles.label,
  };

  return (
    <TextInput
      classNames={typeof classNames === "object" ? { ...own, ...classNames } : own}
      {...props}
    />
  );
}
