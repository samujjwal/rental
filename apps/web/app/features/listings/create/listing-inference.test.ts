import { describe, it, expect, vi } from "vitest";

vi.mock("~/config/locale", () => ({
  APP_MAP_CENTER: [12.34, 56.78] as [number, number],
}));

vi.mock("~/lib/api/geo", () => ({
  geoApi: {
    autocomplete: vi.fn(),
  },
}));

const { geoApi } = await import("~/lib/api/geo");
const { inferCoordinates } = await import("~/features/listings/create/listing-inference");

describe("listing-inference inferCoordinates", () => {
  it("falls back to APP_MAP_CENTER when geocoding fails", async () => {
    vi.mocked(geoApi.autocomplete).mockRejectedValueOnce(new Error("offline"));

    await expect(inferCoordinates("Unknown City")).resolves.toEqual({
      lat: 12.34,
      lng: 56.78,
    });
  });

  it("uses known city hints before falling back", async () => {
    await expect(inferCoordinates("Kathmandu")).resolves.toEqual({
      lat: 27.7172,
      lng: 85.324,
    });
  });
});