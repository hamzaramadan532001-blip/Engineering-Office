import { Button } from "@makkah-municipality-gis/ui";
import type { Metadata } from "next";
import StatusScreen from "./components/StatusScreen";
import { ACTION_LABELS, APP_NAME, STATUS_COPY } from "./components/StatusScreen/constants";

export const metadata: Metadata = {
  title: `${STATUS_COPY["404"].title} — ${APP_NAME}`,
  description: STATUS_COPY["404"].message,
};

/** Root 404 — also serves every URL that matches no route. */
export default function NotFound() {
  return (
    <StatusScreen code="404">
      <Button component="a" href="/">
        {ACTION_LABELS.backToMap}
      </Button>
    </StatusScreen>
  );
}
