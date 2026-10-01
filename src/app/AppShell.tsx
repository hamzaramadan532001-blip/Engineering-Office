"use client";

import { Logo } from "@makkah-municipality-gis/ui";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { HiOutlineBars3, HiOutlineClipboardDocumentCheck, HiOutlineMap } from "react-icons/hi2";
import { activeOfficeStore } from "@/lib/activeOffice/store";
import { activeRequestStore } from "@/lib/activeRequest/store";
import styles from "./AppShell.module.scss";
import MapWrapper from "./features/Map/MapWrapper";
import RequestsView from "./features/Requests/RequestsView";
import type { RequestRow } from "./features/Requests/selectors";
import { withBasePath } from "@/lib/api";

type ViewId = "map" | "requests";

const NAV_ITEMS: { id: ViewId; label: string; icon: ReactNode }[] = [
  { id: "map", label: "الخريطة", icon: <HiOutlineMap /> },
  { id: "requests", label: "الطلبات", icon: <HiOutlineClipboardDocumentCheck /> },
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewId>("map");
  const [collapsed, setCollapsed] = useState(false);

  // Refill the signed-in office from the session after a reload — the login screen writes
  // it into the store, but a refresh starts with an empty one. Resolves to null for a
  // Nafath session, which is a normal state. See lib/activeOffice/store.ts.
  useEffect(() => {
    void activeOfficeStore.hydrate();
  }, []);

  /**
   * "عرض على الخريطة": publish which request is open, then switch to the map.
   *
   * Navigation lives here because the shell owns `activeView`, and the store write sits
   * next to it so the two can never disagree — the map is never shown without the request
   * it was opened for, and the request is never set without the map being shown.
   *
   * The map stays mounted (hidden) across view switches, so RequestCadSync reacts to the
   * store change immediately; there is no remount to wait for.
   */
  const handleViewOnMap = (request: RequestRow) => {
    activeRequestStore.setActive({ id: request.id, description: request.description });
    setActiveView("map");
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={styles.sidebarTop}>
          <div className={styles.logoBlock}>
            <Logo src={withBasePath("/Holy_Makkah_Municipality_Logo_Dark.png")} width={140} />
          </div>

          <button
            type="button"
            className={styles.collapseToggle}
            aria-label={collapsed ? "فتح القائمة الجانبية" : "طي القائمة الجانبية"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <HiOutlineBars3 />
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${
                activeView === item.id ? styles.navItemActive : ""
              }`}
              aria-current={activeView === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => setActiveView(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className={styles.content}>
        <div
          className={styles.mapPane}
          style={{ display: activeView === "map" ? "block" : "none" }}
        >
          <MapWrapper />
        </div>

        {activeView === "requests" && (
          <div className={styles.requestsPane}>
            <RequestsView onViewOnMap={handleViewOnMap} />
          </div>
        )}
      </div>
    </div>
  );
}