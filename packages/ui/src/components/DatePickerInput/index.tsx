import {
  type DatePickerInputProps,
  DatePickerInput as MantineDatePickerInput,
} from "@mantine/dates";

export default function DatePickerInput(props: DatePickerInputProps) {
  return <MantineDatePickerInput {...props} />;
}
