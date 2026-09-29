import { beforeEach, describe, expect, it, vi } from "vitest";
import { permissionsStore } from "@/lib/permissions/store";

/**
 * The BusinessMap service can finish loading before the session's grants arrive.
 * These pin what happens in that order, which no other suite covers.
 */

const GRANTED = "الأحياء";
const DENIED = "الجبال";

interface FakeSublayer {
  title: string;
  visible: boolean;
  sublayers?: unknown;
}

let whenCallback: (() => void) | null = null;
let sublayers: FakeSublayer[] = [];

vi.mock("@arcgis/core/layers/MapImageLayer", () => ({
  default: class {
    destroyed = false;
    allSublayers = { forEach: (fn: (s: FakeSublayer) => void) => sublayers.forEach(fn) };
    when(callback: () => void) {
      whenCallback = callback;
      return { catch: () => undefined };
    }
  },
}));

vi.mock("@arcgis/core/core/reactiveUtils", () => ({
  once: () => new Promise(() => undefined),
}));

// A two-layer catalog, filtered by grants exactly like the real module does, so the
// test pins businessMap's own reset decision rather than the catalog's contents.
vi.mock("@/app/features/Map/arcgis.config", () => ({
  BUSINESS_MAP_URL: "https://example/BusinessMap/MapServer",
  getEnabledLayers: () =>
    [
      { id: "districts", label: GRANTED, labelEn: "Districts", defaultVisible: true },
      { id: "mountains", label: DENIED, labelEn: "Mountains", defaultVisible: true },
    ].filter((l) => permissionsStore.allowedLayer(l.label)),
}));

const { createBusinessMapLayer } = await import("./businessMap");

function grant(names: string[]) {
  permissionsStore.setPermissions(
    {
      roles: [],
      isAdministrator: false,
      functions: [],
      mapLayers: names.map((n) => ({ mapServiceLayerName: n, mapServiceUrl: "u" })),
    },
    true,
  );
}

function visibilityOf(title: string): boolean {
  return sublayers.find((s) => s.title === title)?.visible ?? false;
}

describe("createBusinessMapLayer allow-list timing", () => {
  beforeEach(() => {
    permissionsStore.reset();
    whenCallback = null;
    sublayers = [
      { title: GRANTED, visible: true },
      { title: DENIED, visible: true },
    ];
  });

  it("hides everything while the grants are still loading (fail closed)", () => {
    createBusinessMapLayer();
    whenCallback?.();

    expect(visibilityOf(GRANTED)).toBe(false);
    expect(visibilityOf(DENIED)).toBe(false);
  });

  it("applies the configured defaults when grants arrive after the service loads", () => {
    createBusinessMapLayer();
    whenCallback?.();

    grant([GRANTED]);

    expect(visibilityOf(GRANTED)).toBe(true);
    expect(visibilityOf(DENIED)).toBe(false);
  });

  it("applies the defaults immediately when the grants landed first", () => {
    grant([GRANTED]);

    createBusinessMapLayer();
    whenCallback?.();

    expect(visibilityOf(GRANTED)).toBe(true);
    expect(visibilityOf(DENIED)).toBe(false);
  });

  it("never re-shows a layer the user turned off, on a later grant change", () => {
    grant([GRANTED]);
    createBusinessMapLayer();
    whenCallback?.();

    // The user unticks it in the TOC, then the grants are re-fetched on window focus.
    const row = sublayers.find((s) => s.title === GRANTED);
    if (row) row.visible = false;
    grant([GRANTED]);

    expect(visibilityOf(GRANTED)).toBe(false);
  });

  it("hides a layer as soon as its grant is revoked", () => {
    grant([GRANTED]);
    createBusinessMapLayer();
    whenCallback?.();
    expect(visibilityOf(GRANTED)).toBe(true);

    grant([]);

    expect(visibilityOf(GRANTED)).toBe(false);
  });
});
