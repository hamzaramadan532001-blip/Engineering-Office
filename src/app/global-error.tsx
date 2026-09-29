"use client";

import "@makkah-municipality-gis/ui/mantine-styles";

import { Button, ThemeProvider } from "@makkah-municipality-gis/ui";
import { useEffect } from "react";
import StatusScreen from "./components/StatusScreen";
import { ACTION_LABELS } from "./components/StatusScreen/constants";

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

/**
 * Last-resort boundary: the root layout itself failed, so this file supplies its
 * own document. No next/font here — the layout's font never loaded, and the token
 * stack falls back to system-ui.
 */
export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <ThemeProvider>
          <StatusScreen code="500" reference={error.digest}>
            <Button onClick={() => unstable_retry()}>{ACTION_LABELS.retry}</Button>
          </StatusScreen>
        </ThemeProvider>
      </body>
    </html>
  );
}
