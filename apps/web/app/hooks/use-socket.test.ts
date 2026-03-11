import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock socket.io-client with controllable instance
const mockSocket = {
  on: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

let mockAccessToken: string | null = "test-token";
let mockUser: { id: string } | null = { id: "user-1" };

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => ({
    accessToken: mockAccessToken,
    user: mockUser,
  }),
}));

import { io } from "socket.io-client";
import { useSocket } from "./use-socket";

describe("useSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessToken = "test-token";
    mockUser = { id: "user-1" };
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.disconnect.mockReset();
  });

  it("creates a socket connection when authenticated", () => {
    renderHook(() => useSocket());

    expect(io).toHaveBeenCalledWith(
      expect.stringContaining("/messaging"),
      expect.objectContaining({
        auth: { token: "test-token", userId: "user-1" },
        transports: ["websocket"],
      }),
    );
  });

  it("does not connect when no accessToken", () => {
    mockAccessToken = null;

    renderHook(() => useSocket());

    expect(io).not.toHaveBeenCalled();
  });

  it("does not connect when no user", () => {
    mockUser = null;

    renderHook(() => useSocket());

    expect(io).not.toHaveBeenCalled();
  });

  it("returns isConnected false initially", () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current.isConnected).toBe(false);
  });

  it("sets isConnected true on connect event", () => {
    const { result } = renderHook(() => useSocket());

    // Find and invoke the "connect" handler
    const connectCall = mockSocket.on.mock.calls.find(
      (c: unknown[]) => c[0] === "connect",
    ) as [string, () => void] | undefined;
    expect(connectCall).toBeDefined();

    act(() => {
      connectCall![1]();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("sets isConnected false on disconnect event", () => {
    const { result } = renderHook(() => useSocket());

    // First connect
    const connectCall = mockSocket.on.mock.calls.find(
      (c: unknown[]) => c[0] === "connect",
    ) as [string, () => void] | undefined;
    act(() => {
      connectCall![1]();
    });
    expect(result.current.isConnected).toBe(true);

    // Then disconnect
    const disconnectCall = mockSocket.on.mock.calls.find(
      (c: unknown[]) => c[0] === "disconnect",
    ) as [string, () => void] | undefined;
    act(() => {
      disconnectCall![1]();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("registers connect_error handler", () => {
    renderHook(() => useSocket());

    const errorCall = mockSocket.on.mock.calls.find(
      (c: unknown[]) => c[0] === "connect_error",
    ) as [string, () => void] | undefined;
    expect(errorCall).toBeDefined();
  });

  it("disconnects on unmount when connected", () => {
    mockSocket.connected = false;

    const { unmount } = renderHook(() => useSocket());

    // Simulate socket becoming connected
    mockSocket.connected = true;
    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
