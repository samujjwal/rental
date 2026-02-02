import { useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";
import { useAuthStore } from "~/lib/store/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3400/api";
// Remove /api and add namespace
const SOCKET_URL = API_URL.replace("/api", "") + "/messaging";

export function useSocket() {
  const { accessToken, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!accessToken || !user) return;

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
      console.log("Socket connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
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
