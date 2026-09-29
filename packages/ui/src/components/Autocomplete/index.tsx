import {
  Autocomplete as MantineAutocomplete,
  type AutocompleteProps as MantineAutocompleteProps,
} from "@mantine/core";
import type React from "react";

export type AutocompleteProps = MantineAutocompleteProps & React.RefAttributes<HTMLInputElement>;

/** Free-text field with suggestions (layer name, department, service URL). */
export default function Autocomplete({
  radius = "md",
  maxDropdownHeight = 240,
  ...props
}: AutocompleteProps) {
  return <MantineAutocomplete radius={radius} maxDropdownHeight={maxDropdownHeight} {...props} />;
}
