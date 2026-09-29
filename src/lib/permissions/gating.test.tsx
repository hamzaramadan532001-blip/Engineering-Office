import { ThemeProvider } from "@makkah-municipality-gis/ui";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnabledLayers } from "@/app/features/Map/arcgis.config";
import { MapProvider } from "@/app/features/Map/MapProvidor";
import Widgets from "@/app/features/Map/MapTools/SubTools/Widgets";
import { PermissionsProvider } from "./PermissionsProvider";
import { permissionsStore } from "./store";
import type { UserPermissions } from "./types";

const PRINT_LABEL = "طباعة";
const SEARCH_LABEL = "البحث المكاني";
const MEASURE_LABEL = "القياسات";

const GRANTS: UserPermissions = {
  roles: ["GISViewer"],
  isAdministrator: false,
  functions: [{ functionName: "PrintMap", functionNameAr: null }],
  mapLayers: [
    { mapServiceLayerName: "الأحياء", mapServiceUrl: "https://example/0" },
    { mapServiceLayerName: "حد الحرم", mapServiceUrl: "https://example/1" },
  ],
};

function renderWidgetBar() {
  return render(
    <ThemeProvider>
      <MapProvider>
        <Widgets />
      </MapProvider>
    </ThemeProvider>,
  );
}

describe("widget registry gating", () => {
  beforeEach(() => {
    permissionsStore.reset();
  });

  it("renders no widget buttons while permissions load — no flash of forbidden tools", () => {
    renderWidgetBar();

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(PRINT_LABEL)).toBeNull();
    expect(screen.queryByText(MEASURE_LABEL)).toBeNull();
  });

  it("keeps only the widgets whose function the session holds", () => {
    permissionsStore.setPermissions(GRANTS, true);

    renderWidgetBar();

    expect(screen.getByText(PRINT_LABEL)).toBeTruthy(); // PrintMap granted
    expect(screen.queryByText(SEARCH_LABEL)).toBeNull(); // SearchFunctions not granted
    expect(screen.queryByText(MEASURE_LABEL)).toBeNull(); // MeasureWidget not granted
  });

  it("shows a widget once its function is granted", () => {
    permissionsStore.setPermissions(
      {
        ...GRANTS,
        functions: [...GRANTS.functions, { functionName: "MeasureWidget", functionNameAr: null }],
      },
      true,
    );

    renderWidgetBar();

    expect(screen.getByText(MEASURE_LABEL)).toBeTruthy();
  });

  it("shows a gated widget as soon as its function is granted", () => {
    permissionsStore.setPermissions(
      {
        ...GRANTS,
        functions: [...GRANTS.functions, { functionName: "searchfunctions", functionNameAr: null }],
      },
      true,
    );

    renderWidgetBar();

    expect(screen.getByText(SEARCH_LABEL)).toBeTruthy();
  });
});

describe("layer catalog gating", () => {
  beforeEach(() => {
    permissionsStore.reset();
  });

  it("exposes no layers before the grants land (fail closed)", () => {
    expect(getEnabledLayers()).toHaveLength(0);
  });

  it("keeps only granted layers, matched on the Arabic label", () => {
    permissionsStore.setPermissions(GRANTS, true);

    const ids = getEnabledLayers().map((l) => l.id);
    expect(ids).toContain("districts"); // الأحياء
    expect(ids).toContain("haram-boundary"); // حد الحرم
    expect(ids).not.toContain("mountains");
    expect(ids).toHaveLength(2);
  });

  it("drops a layer again when the grant is revoked", () => {
    permissionsStore.setPermissions(GRANTS, true);
    expect(getEnabledLayers()).toHaveLength(2);

    permissionsStore.setPermissions({ ...GRANTS, mapLayers: [] }, true);
    expect(getEnabledLayers()).toHaveLength(0);
  });
});

describe("permission load", () => {
  const sessionBody = {
    authenticated: true,
    roles: ["GISViewer"],
    isAdministrator: false,
    functions: GRANTS.functions,
    mapLayers: GRANTS.mapLayers,
  };

  function sessionCalls(fetchMock: ReturnType<typeof vi.fn>): number {
    return fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/auth/session"))
      .length;
  }

  beforeEach(() => {
    permissionsStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-reads the grants when the window regains focus", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sessionBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PermissionsProvider>
        <span>map</span>
      </PermissionsProvider>,
    );

    await waitFor(() => expect(permissionsStore.can("PrintMap")).toBe(true));
    expect(sessionCalls(fetchMock)).toBe(1);

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(sessionCalls(fetchMock)).toBe(2));
  });

  it("surfaces a failed load in Arabic instead of silently hiding everything", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 502 })),
    );

    render(
      <ThemeProvider>
        <PermissionsProvider>
          <span>map</span>
        </PermissionsProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText(/تعذّر تحميل الصلاحيات/)).toBeTruthy());
    expect(permissionsStore.can("PrintMap")).toBe(false);
  });
});
