import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { geoApi } from "~/lib/api/geo";

describe("geoApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("autocomplete calls GET /geo/autocomplete with query", async () => {
    mockApi.get.mockResolvedValue({ results: [] });
    await geoApi.autocomplete("Kathmandu");
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("/geo/autocomplete");
    expect(url).toContain("q=Kathmandu");
  });

  it("autocomplete includes optional params", async () => {
    mockApi.get.mockResolvedValue({ results: [] });
    await geoApi.autocomplete("Thamel", {
      limit: 5,
      lang: "ne",
      biasLat: 27.7,
      biasLon: 85.3,
      biasZoom: 14,
      biasScale: 0.5,
      bbox: "85,27,86,28",
      layer: "address",
    });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("limit=5");
    expect(url).toContain("lang=ne");
    expect(url).toContain("lat=27.7");
    expect(url).toContain("lon=85.3");
    expect(url).toContain("zoom=14");
    expect(url).toContain("location_bias_scale=0.5");
    expect(url).toContain("layer=address");
  });

  it("reverse calls GET /geo/reverse with lat/lon", async () => {
    mockApi.get.mockResolvedValue({ result: null });
    await geoApi.reverse(27.7, 85.3);
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("/geo/reverse");
    expect(url).toContain("lat=27.7");
    expect(url).toContain("lon=85.3");
  });

  it("reverse passes lang param", async () => {
    mockApi.get.mockResolvedValue({ result: { id: "1" } });
    await geoApi.reverse(27.7, 85.3, "ne");
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("lang=ne");
  });
});
