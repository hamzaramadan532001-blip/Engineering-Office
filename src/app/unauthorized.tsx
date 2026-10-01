import { Button } from "@makkah-municipality-gis/ui";
import type { Metadata } from "next";
import StatusScreen from "./components/StatusScreen";
import { ACTION_LABELS, APP_NAME, STATUS_COPY } from "./components/StatusScreen/constants";
import { withBasePath } from "@/lib/api";

export const metadata: Metadata = {
  title: `${STATUS_COPY["401"].title} — ${APP_NAME}`,
  description: STATUS_COPY["401"].message,
};

/** 401 — rendered when a server component calls `unauthorized()` from next/navigation. */
export default function Unauthorized() {
  return (
    <StatusScreen code="401">
      <Button component="a" href={withBasePath("/login")}>
        {ACTION_LABELS.signIn}
      </Button>
    </StatusScreen>
  );
}
