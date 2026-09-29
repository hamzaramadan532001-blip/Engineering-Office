"use client";

import { ThemeProvider as UiThemeProvider } from "@makkah-municipality-gis/ui";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";

/** Pins Mantine's color scheme to our theme so its components follow the toggle. */
function MantineSchemeBridge({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <UiThemeProvider forceColorScheme={theme}>{children}</UiThemeProvider>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MantineSchemeBridge>{children}</MantineSchemeBridge>
    </ThemeProvider>
  );
}
