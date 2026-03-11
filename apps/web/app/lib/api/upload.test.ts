import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { uploadApi } from "~/lib/api/upload";

describe("uploadApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploadImage sends FormData with file to /upload/image", async () => {
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    mockApi.post.mockResolvedValue({ url: "https://cdn.np/a.jpg", key: "a" });

    const result = await uploadApi.uploadImage(file);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/upload/image",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(result.url).toBe("https://cdn.np/a.jpg");
  });

  it("uploadImages sends multiple files to /upload/images", async () => {
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    mockApi.post.mockResolvedValue([{ url: "u1" }, { url: "u2" }]);

    const result = await uploadApi.uploadImages(files);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/upload/images",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(result).toHaveLength(2);
  });

  it("uploadDocument sends to /upload/document", async () => {
    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    mockApi.post.mockResolvedValue({ url: "https://cdn.np/d.pdf", key: "d" });

    await uploadApi.uploadDocument(file);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/upload/document",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });
});
