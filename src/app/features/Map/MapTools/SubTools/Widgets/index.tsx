import { Button, Skeleton } from "@makkah-municipality-gis/ui";
import { useCallback } from "react";
import { useMap } from "@/app/features/Map/MapProvidor";
import { usePermissions } from "@/lib/permissions";
import { WIDGET_ENTRIES, type Widgets as WidgetId } from "./constants";

/** Placeholder count while permissions load — sized like the widest plausible bar. */
const SKELETON_KEYS = ["w-1", "w-2", "w-3", "w-4", "w-5", "w-6"];

export default function Widgets() {
  const {
    dispatch,
    state: { openSubTools },
  } = useMap();
  const { loading, can } = usePermissions();

  const handleSelectTool = useCallback(
    (tool: WidgetId) => {
      // Toggle this tool's panel: opening it doesn't close any other tool that
      // is already open, several can stay open side by side at once.
      dispatch({ type: "toggleSubTool", payload: tool });
    },
    [dispatch],
  );

  // Fail closed: render placeholders rather than buttons the session may not hold.
  if (loading) {
    return (
      <>
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} height={36} width={120} radius="sm" />
        ))}
      </>
    );
  }

  const allowed = WIDGET_ENTRIES.filter((w) => !w.requiredFunction || can(w.requiredFunction));

  return (
    <>
      {allowed.map(({ label, Icon, id }) => {
        const selected = openSubTools.includes(id);
        const variant = selected ? "filled" : "outline";
        return (
          <Button
            key={label}
            variant={variant}
            leftSection={<Icon aria-hidden />}
            onClick={() => handleSelectTool(id)}
          >
            {label}
          </Button>
        );
      })}
    </>
  );
}
