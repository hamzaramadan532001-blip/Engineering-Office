"use client";

import { Button } from "@makkah-municipality-gis/ui";
import { useEffect } from "react";
import StatusScreen from "./components/StatusScreen";
import { ACTION_LABELS } from "./components/StatusScreen/constants";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  /** Next 16 re-renders the segment; `reset` was the pre-16 name. */
  unstable_retry: () => void;
}

/** Segment error boundary — every uncaught render error below the root layout. */
export default function ErrorPage({ error, unstable_retry }: ErrorPageProps) {
  // The console line is the operator's copy; the screen below is the user's.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen code="500" reference={error.digest}>
      <Button onClick={() => unstable_retry()}>{ACTION_LABELS.retry}</Button>
      <Button component="a" href="/" variant="outline">
        {ACTION_LABELS.backToMap}
      </Button>
    </StatusScreen>
  );
}
