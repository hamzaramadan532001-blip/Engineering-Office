import { Button, MapBox } from "@makkah-municipality-gis/ui";
import { useCallback } from "react";
import { HiChevronUp } from "react-icons/hi2";
import { useMap } from "../MapProvidor";
import SubTools from "./SubTools";
import type { AvailableTools } from "./SubTools/types";
import styles from "./styles.module.scss";

type MapToolTab = {
  readonly id: AvailableTools[number];
  readonly label: string;
};

const MAP_TOOL_TABS: readonly MapToolTab[] = [{ id: "widgets", label: "الأدوات" }];

export default function MapTools() {
  const { state, dispatch } = useMap();
  const { selectedTool } = state;

  const isExpanded = selectedTool !== null;

  const handleSelectTool = useCallback(
    (tool: AvailableTools[number]) => {
      dispatch({ type: "setSelectedTool", payload: selectedTool === tool ? null : tool });
    },
    [dispatch, selectedTool],
  );

  const tabs = MAP_TOOL_TABS;

  return (
    <MapBox data-slot-bottom-center className={styles["map-tools"]}>
      {isExpanded && (
        <div className={styles.expandedPanel}>
          <SubTools />
        </div>
      )}
      <div className={styles.dockBar}>
        <div className={styles.spacer} />
        <div className={styles.tabs} role="toolbar" aria-label="أدوات الخريطة">
          {tabs.map(({ id, label }) => {
            const selected = selectedTool === id;
            const variant = selected ? "filled" : "outline";
            return (
              <Button
                key={id}
                variant={variant}
                aria-pressed={selected}
                leftSection={<HiChevronUp aria-hidden />}
                onClick={() => handleSelectTool(id)}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <div className={styles.spacer} />
      </div>
    </MapBox>
  );
}
