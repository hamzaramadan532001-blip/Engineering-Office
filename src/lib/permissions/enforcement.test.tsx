import { ThemeProvider } from "@makkah-municipality-gis/ui";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnabledLayers } from "@/app/features/Map/arcgis.config";
import { MapProvider } from "@/app/features/Map/MapProvidor";
import Widgets from "@/app/features/Map/MapTools/SubTools/Widgets";
import { PermissionsProvider } from "./PermissionsProvider";
import { permissionsStore } from "./store";

const BANNER = /صلاحيات المستخدمين غير مفعّلة/;
const SEARCH_LABEL = "البحث المكاني";

const NO_GRANTS = { roles: [], isAdministrator: false, functions: [], mapLayers: [] };

/** The session envelope a PERMISSIONS_ENFORCEMENT=off (or dev-mock) server returns. */
const UNENFORCED_SESSION = {
  authenticated: true,
  roles: [],
  isAdministrator: false,
  functions: [],
  mapLayers: [],
  mock: false,
  enforcement: "off",
};

const ENFORCED_SESSION = {
  authenticated: true,
  roles: ["GISViewer"],
  isAdministrator: false,
  functions: [{ functionName: "PrintMap", functionNameAr: null }],
  mapLayers: [{ mapServiceLayerName: "الأحياء", mapServiceUrl: "https://example/0" }],
  enforcement: "on",
};

function stubSession(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <PermissionsProvider>
        <span>map</span>
      </PermissionsProvider>
    </ThemeProvider>,
  );
}

describe("unenforced permissions", () => {
  beforeEach(() => {
    permissionsStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells the user in Arabic that nothing is being enforced", async () => {
    stubSession(UNENFORCED_SESSION);

    renderProvider();

    await waitFor(() => expect(screen.getByText(BANNER)).toBeTruthy());
  });

  it("stops gating capabilities and layers when the server enforces nothing", async () => {
    stubSession(UNENFORCED_SESSION);

    renderProvider();

    await waitFor(() => expect(permissionsStore.getSnapshot().enforced).toBe(false));
    expect(permissionsStore.can("PrintMap")).toBe(true);
    expect(permissionsStore.can("AnythingAtAll")).toBe(true);
    expect(permissionsStore.allowedLayer("الجبال")).toBe(true);
  });

  it("keeps the widget bar and the layer catalog populated with no grants at all", () => {
    permissionsStore.setPermissions(NO_GRANTS, false);

    render(
      <ThemeProvider>
        <MapProvider>
          <Widgets />
        </MapProvider>
      </ThemeProvider>,
    );

    // The gated widget the granted-only run drops, and the layers case 3 used to blank.
    expect(screen.getByText(SEARCH_LABEL)).toBeTruthy();
    expect(getEnabledLayers().length).toBeGreaterThan(0);
  });

  it("shows no banner and keeps gating when the server enforces", async () => {
    stubSession(ENFORCED_SESSION);

    renderProvider();

    await waitFor(() => expect(permissionsStore.can("PrintMap")).toBe(true));
    expect(screen.queryByText(BANNER)).toBeNull();
    expect(permissionsStore.can("SearchFunctions")).toBe(false);
    expect(permissionsStore.allowedLayer("الجبال")).toBe(false);
  });

  it("enforces when the envelope carries no enforcement field at all (fail closed)", async () => {
    const { enforcement: _dropped, ...legacy } = ENFORCED_SESSION;
    stubSession(legacy);

    renderProvider();

    await waitFor(() => expect(permissionsStore.getSnapshot().status).toBe("ready"));
    expect(permissionsStore.getSnapshot().enforced).toBe(true);
    expect(screen.queryByText(BANNER)).toBeNull();
    expect(permissionsStore.can("SearchFunctions")).toBe(false);
  });
});
