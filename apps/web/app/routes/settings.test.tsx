import { describe, it, expect, vi } from "vitest";

/* settings.tsx is a redirect-only route */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => ({ type: "redirect", url })),
}));

vi.mock("react-router", () => ({
  redirect: mocks.redirect,
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader } from "./settings";
import SettingsIndex from "./settings";

describe("settings (layout redirect)", () => {
  it("clientLoader redirects to /settings/profile", () => {
    clientLoader();
    expect(mocks.redirect).toHaveBeenCalledWith("/settings/profile");
  });

  it("renders null", () => {
    expect(SettingsIndex()).toBeNull();
  });
});
