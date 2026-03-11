import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { messagingApi } from "~/lib/api/messaging";

describe("messagingApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ====== Conversations ======
  it("createConversation calls POST /conversations", async () => {
    const data = { listingId: "l1", participantId: "u2" };
    mockApi.post.mockResolvedValue({ id: "conv1", ...data });
    const result = await messagingApi.createConversation(data);
    expect(mockApi.post).toHaveBeenCalledWith("/conversations", data);
    expect(result.id).toBe("conv1");
  });

  it("getConversations calls GET /conversations without params", async () => {
    mockApi.get.mockResolvedValue({ conversations: [], total: 0 });
    await messagingApi.getConversations();
    expect(mockApi.get).toHaveBeenCalledWith("/conversations");
  });

  it("getConversations passes page/limit/search params", async () => {
    mockApi.get.mockResolvedValue({ conversations: [], total: 0 });
    await messagingApi.getConversations({ page: 2, limit: 10, search: "hello" });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
    expect(url).toContain("search=hello");
  });

  it("getConversation calls GET /conversations/:id", async () => {
    mockApi.get.mockResolvedValue({ id: "conv1" });
    const result = await messagingApi.getConversation("conv1");
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/conv1");
    expect(result.id).toBe("conv1");
  });

  // ====== Messages ======
  it("getMessages calls GET /conversations/:id/messages", async () => {
    mockApi.get.mockResolvedValue({ messages: [], total: 0, hasMore: false });
    await messagingApi.getMessages("conv1");
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/conv1/messages");
  });

  it("getMessages passes pagination params", async () => {
    mockApi.get.mockResolvedValue({ messages: [], total: 0, hasMore: false });
    await messagingApi.getMessages("conv1", { page: 3, limit: 20, before: "msg-100" });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("page=3");
    expect(url).toContain("limit=20");
    expect(url).toContain("before=msg-100");
  });

  it("sendMessage calls POST /conversations/:id/messages", async () => {
    const msgData = { content: "Hello!", attachments: ["file.pdf"] };
    mockApi.post.mockResolvedValue({ id: "msg1", content: "Hello!" });
    const result = await messagingApi.sendMessage("conv1", msgData);
    expect(mockApi.post).toHaveBeenCalledWith("/conversations/conv1/messages", msgData);
    expect(result.content).toBe("Hello!");
  });

  // ====== Read Receipts ======
  it("markAsRead calls POST /conversations/:id/read", async () => {
    mockApi.post.mockResolvedValue({ marked: 5 });
    const result = await messagingApi.markAsRead("conv1");
    expect(mockApi.post).toHaveBeenCalledWith("/conversations/conv1/read");
    expect(result.marked).toBe(5);
  });

  it("getUnreadCount calls GET /conversations/unread-count", async () => {
    mockApi.get.mockResolvedValue({ count: 3 });
    const result = await messagingApi.getUnreadCount();
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/unread-count");
    expect(result.count).toBe(3);
  });

  // ====== Deletion ======
  it("deleteConversation calls DELETE /conversations/:id", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await messagingApi.deleteConversation("conv1");
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/conv1");
  });

  it("deleteMessage calls DELETE /conversations/messages/:id", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await messagingApi.deleteMessage("msg1");
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/messages/msg1");
  });
});
