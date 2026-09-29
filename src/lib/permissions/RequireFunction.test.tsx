import { ThemeProvider } from "@makkah-municipality-gis/ui";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { RequireFunction } from "./RequireFunction";
import { permissionsStore } from "./store";
import type { UserPermissions } from "./types";

const DENIED_TEXT = "تتطلب صلاحية تصدير الخريطة";

const GRANTS: UserPermissions = {
  roles: ["GISViewer"],
  isAdministrator: false,
  functions: [{ functionName: "PrintMap", functionNameAr: null }],
  mapLayers: [],
};

function renderGate(children: ReactNode) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

describe("RequireFunction", () => {
  beforeEach(() => {
    permissionsStore.reset();
  });

  it("renders nothing while permissions are still loading", () => {
    renderGate(
      <RequireFunction fn="PrintMap">
        <button type="button">تصدير</button>
      </RequireFunction>,
    );

    expect(screen.queryByRole("button", { name: "تصدير" })).toBeNull();
  });

  it("renders nothing when the capability is denied", () => {
    permissionsStore.setPermissions(GRANTS, true);

    renderGate(
      <RequireFunction fn="ExportMap">
        <button type="button">تصدير</button>
      </RequireFunction>,
    );

    expect(screen.queryByRole("button", { name: "تصدير" })).toBeNull();
  });

  it("renders the children when the capability is granted", () => {
    permissionsStore.setPermissions(GRANTS, true);

    renderGate(
      <RequireFunction fn="printmap">
        <button type="button">تصدير</button>
      </RequireFunction>,
    );

    expect(screen.getByRole("button", { name: "تصدير" })).toBeTruthy();
  });

  it("disables the children and explains why in Arabic when mode=disable", () => {
    permissionsStore.setPermissions(GRANTS, true);

    const { container } = renderGate(
      <RequireFunction fn="ExportMap" mode="disable" disabledTooltipAr={DENIED_TEXT}>
        <button type="button">تصدير</button>
      </RequireFunction>,
    );

    const wrapper = container.querySelector("fieldset");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("aria-label")).toBe(DENIED_TEXT);
    expect(wrapper?.hasAttribute("disabled")).toBe(true);
    // Inside a Dragable panel the wrapper must never start a panel drag (rule 6).
    expect(wrapper?.hasAttribute("data-no-drag")).toBe(true);
    // The control is still shown — but a disabled fieldset makes it unusable.
    const control = screen.getByRole("button", { name: "تصدير" });
    expect(control.closest("fieldset[disabled]")).toBe(wrapper);
  });

  it("shows the disabled state while loading too, never the live control", () => {
    const { container } = renderGate(
      <RequireFunction fn="ExportMap" mode="disable" disabledTooltipAr={DENIED_TEXT}>
        <button type="button">تصدير</button>
      </RequireFunction>,
    );

    const control = screen.getByRole("button", { name: "تصدير" });
    expect(control.closest("fieldset[disabled]")).not.toBeNull();
    expect(container.querySelector("fieldset")?.getAttribute("aria-label")).toBe(DENIED_TEXT);
  });
});
