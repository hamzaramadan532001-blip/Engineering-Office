"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "./themeScript";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDocument(theme: Theme) {
  const isDark = theme === "dark";
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);

  // Mantine also gets forceColorScheme via AppProviders; stamping the attribute
  // here keeps it correct before that provider re-renders.
  el.setAttribute("data-mantine-color-scheme", theme);
  // Esri's `<arcgis-*>` widgets theme through Calcite's mode class.
  el.classList.toggle("calcite-mode-dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light";
  });

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private browsing / storage disabled — theme still works for this session.
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
