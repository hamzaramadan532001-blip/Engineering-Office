import { beforeEach, describe, expect, it } from "vitest";
import { permissionsStore } from "./store";
import type { UserPermissions } from "./types";

const GRANTS: UserPermissions = {
  roles: ["GISViewer"],
  isAdministrator: false,
  functions: [
    { functionName: "PrintMap", functionNameAr: "طباعة الخريطة" },
    { functionName: "SearchFunctions", functionNameAr: "وظائف البحث" },
  ],
  mapLayers: [{ mapServiceLayerName: "الأحياء", mapServiceUrl: "https://example/0" }],
};

describe("permissionsStore", () => {
  beforeEach(() => {
    permissionsStore.reset();
  });

  it("denies every capability while permissions are loading (fail closed)", () => {
    expect(permissionsStore.getSnapshot().status).toBe("loading");
    expect(permissionsStore.can("PrintMap")).toBe(false);
    expect(permissionsStore.allowedLayer("الأحياء")).toBe(false);
  });

  it("denies every capability after a failed load", () => {
    permissionsStore.setPermissions(GRANTS, true);
    permissionsStore.setError("upstream");

    expect(permissionsStore.can("PrintMap")).toBe(false);
    expect(permissionsStore.allowedLayer("الأحياء")).toBe(false);
  });

  it("matches function names case-insensitively", () => {
    permissionsStore.setPermissions(GRANTS, true);

    expect(permissionsStore.can("PrintMap")).toBe(true);
    expect(permissionsStore.can("printmap")).toBe(true);
    expect(permissionsStore.can("PRINTMAP")).toBe(true);
    expect(permissionsStore.can("ExportMap")).toBe(false);
  });

  it("matches layer names case-insensitively and across Arabic spellings", () => {
    permissionsStore.setPermissions(GRANTS, true);

    expect(permissionsStore.allowedLayer("الأحياء")).toBe(true);
    expect(permissionsStore.allowedLayer("الاحياء")).toBe(true); // bare alef
    expect(permissionsStore.allowedLayer("  الأحياء  ")).toBe(true);
    expect(permissionsStore.allowedLayer("الجبال")).toBe(false);
  });

  it("stops gating in the dev mock, where there are no grants to enforce", () => {
    permissionsStore.setPermissions(
      { roles: [], isAdministrator: false, functions: [], mapLayers: [] },
      false,
    );

    expect(permissionsStore.can("PrintMap")).toBe(true);
    expect(permissionsStore.allowedLayer("الجبال")).toBe(true);
  });

  it("notifies subscribers when grants change", () => {
    let notified = 0;
    const stop = permissionsStore.subscribe(() => {
      notified += 1;
    });

    permissionsStore.setPermissions(GRANTS, true);
    stop();
    permissionsStore.setError("network");

    expect(notified).toBe(1);
  });
});
