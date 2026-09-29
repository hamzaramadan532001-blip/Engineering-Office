// Design tokens only. Mantine's own stylesheets are a separate entry point
// (`@makkah-municipality-gis/ui/mantine-styles`) so each app can choose the
// plain or the `@layer mantine` build — see styles/mantine-styles.ts.
import "../styles/main.scss";

import { createTheme, DirectionProvider, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

const theme = createTheme({
  /** Put your mantine theme override here */
  primaryColor: "green",
  primaryShade: 6,
  fontFamily: "var(--font-ibm-sans)",
  /** DGA design tokens: 8px corner radius is the system default */
  defaultRadius: "md",
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Writing direction. Defaults to RTL — the Arabic-first case. */
  direction?: "rtl" | "ltr";
  /** Pin Mantine's color scheme to the app's own theme state (e.g. a dark-mode toggle). */
  forceColorScheme?: "light" | "dark";
}

export default function ThemeProvider({
  children,
  direction = "rtl",
  forceColorScheme,
}: ThemeProviderProps) {
  return (
    <DirectionProvider initialDirection={direction}>
      <MantineProvider theme={theme} forceColorScheme={forceColorScheme}>
        <Notifications position="bottom-center" />
        {children}
      </MantineProvider>
    </DirectionProvider>
  );
}
