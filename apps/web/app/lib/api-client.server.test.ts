import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios", () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

describe("ServerApiClient", () => {
  let serverApi: any;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh module
    vi.resetModules();
    const mod = await import("~/lib/api-client.server");
    serverApi = mod.serverApi;
    mockClient = (axios.create as any).mock.results[0]?.value;
  });

  it("creates axios instance with default base URL", () => {
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: expect.stringContaining("localhost:3400"),
        timeout: 30000,
      }),
    );
  });

  it("get returns response.data", async () => {
    mockClient.get.mockResolvedValue({ data: { id: "1" } });
    const result = await serverApi.get("/test");
    expect(mockClient.get).toHaveBeenCalledWith("/test", undefined);
    expect(result).toEqual({ id: "1" });
  });

  it("post returns response.data", async () => {
    mockClient.post.mockResolvedValue({ data: { ok: true } });
    const result = await serverApi.post("/test", { a: 1 });
    expect(mockClient.post).toHaveBeenCalledWith("/test", { a: 1 }, undefined);
    expect(result).toEqual({ ok: true });
  });

  it("patch returns response.data", async () => {
    mockClient.patch.mockResolvedValue({ data: { updated: true } });
    const result = await serverApi.patch("/test/1", { b: 2 });
    expect(mockClient.patch).toHaveBeenCalledWith("/test/1", { b: 2 }, undefined);
    expect(result).toEqual({ updated: true });
  });

  it("delete returns response.data", async () => {
    mockClient.delete.mockResolvedValue({ data: null });
    const result = await serverApi.delete("/test/1");
    expect(mockClient.delete).toHaveBeenCalledWith("/test/1", undefined);
    expect(result).toBeNull();
  });

  it("passes config through to axios methods", async () => {
    const config = { headers: { "X-Custom": "val" } };
    mockClient.get.mockResolvedValue({ data: {} });
    await serverApi.get("/test", config);
    expect(mockClient.get).toHaveBeenCalledWith("/test", config);
  });
});
