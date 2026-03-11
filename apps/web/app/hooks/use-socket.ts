import { useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";
import { useAuthStore } from "~/lib/store/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3400/api";
// Remove /api and add namespace
const SOCKET_URL = API_URL.replace("/api", "") + "/messaging";

export function useSocket(activeConversationId?: string | null) {
  const { accessToken, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const prevTokenRef = useRef<string | null>(null);
  const activeConversationRef = useRef<string | null>(null);

  // Keep the ref in sync so the connect handler always has the latest value
  useEffect(() => {
    activeConversationRef.current = activeConversationId ?? null;
  }, [activeConversationId]);

  useEffect(() => {
    if (!accessToken || !user) return;

    // Disconnect and reconnect if token has changed (e.g. after refresh)
    const tokenChanged = prevTokenRef.current !== null && prevTokenRef.current !== accessToken;
    if (tokenChanged && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    prevTokenRef.current = accessToken;

    // Avoid double connections
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
        userId: user.id, // Providing userId as per gateway expectation
      },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      // Rejoin the active conversation after a reconnect
      if (activeConversationRef.current) {
        socket.emit("join_conversation", { conversationId: activeConversationRef.current });
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [accessToken, user?.id]);

  return { socket: socketRef.current, isConnected };
}
