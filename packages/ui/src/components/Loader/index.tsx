import { type LoaderProps, Loader as MantineLoader } from "@mantine/core";

/** Loading indicator (DGA loading/status). Green by theme default. */
export default function Loader({ color = "green", ...props }: LoaderProps) {
  return <MantineLoader color={color} {...props} />;
}
