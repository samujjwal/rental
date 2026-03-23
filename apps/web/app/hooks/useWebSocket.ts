/**
 * @deprecated This hook uses the native browser WebSocket API and is NOT connected
 * to the Socket.IO-based backend (`/messaging` namespace). It will not receive
 * messages from the server in production. Use `useMessaging` (or the Socket.IO
 * client in `apps/web/app/lib/socket.ts`) instead.
 *
 * Kept for reference; do not add new usages.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '~/lib/toast';
import { useAuthStore } from '~/lib/store/auth';

// VITE_WS_URL is injected at build time via vite.config.ts define block.
// Falls back to localhost for local development only.
const WS_BASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL as string | undefined) ||
  'ws://localhost:3001';

const DEFAULT_PROTOCOLS: string[] = [];

export function getWebSocketConnectionError(options?: {
  isOffline?: boolean;
  exhaustedRetries?: boolean;
}): string {
  if (options?.isOffline) {
    return 'You appear to be offline. Reconnect to resume real-time updates.';
  }

  if (options?.exhaustedRetries) {
    return 'We could not reconnect to real-time updates. Try again in a moment.';
  }

  return 'We could not connect to real-time updates right now.';
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id: string;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (type: string, data: any) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  error: string | null;
}

export function useWebSocket(config: WebSocketConfig): UseWebSocketReturn {
  const { user, accessToken } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000
  } = config;
  const protocols = config.protocols ?? DEFAULT_PROTOCOLS;

  const resolveConnectionError = useCallback(
    (exhaustedRetries = false) =>
      getWebSocketConnectionError({
        isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
        exhaustedRetries,
      }),
    []
  );

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const dispatchBookingUpdate = useCallback((detail: Record<string, unknown>) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('booking:update', { detail }));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      setError(null);

      // F-07 fix: Never embed the auth token in the WebSocket URL (it would
      // appear in server logs and browser history).  Connect to the plain URL
      // and pass auth as the first message after the handshake instead.
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send auth token as first message (not in URL)
        if (accessToken) {
          ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
        }

        // Send queued messages
        if (messageQueueRef.current.length > 0) {
          messageQueueRef.current.forEach(message => {
            ws.send(JSON.stringify(message));
          });
          messageQueueRef.current = [];
        }

        clearReconnectTimeout();

        const queueHeartbeat = () => {
          clearHeartbeatTimeout();
          heartbeatTimeoutRef.current = setTimeout(() => {
            heartbeatTimeoutRef.current = null;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              queueHeartbeat();
            }
          }, heartbeatInterval);
        };

        queueHeartbeat();

        toast.success('Real-time updates connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle ping/pong
          if (message.type === 'pong') {
            return;
          }

          setLastMessage(message);

          // Handle different message types
          switch (message.type) {
            case 'booking_update':
              handleBookingUpdate(message.data);
              break;
            case 'message_notification':
              handleMessageNotification(message.data);
              break;
            case 'system_notification':
              handleSystemNotification(message.data);
              break;
            case 'price_alert':
              handlePriceAlert(message.data);
              break;
            default:
              console.log('Unknown message type:', message.type, message.data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Clear heartbeat
        clearHeartbeatTimeout();

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          reconnectAttemptsRef.current++;
          const reconnectDelay = reconnectInterval * reconnectAttemptsRef.current;

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const message = resolveConnectionError(true);
          setConnectionStatus('error');
          setError(message);
          toast.error(message);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setIsConnected(false);
        setError(resolveConnectionError());
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError(resolveConnectionError());
      setConnectionStatus('error');
    }
  }, [
    accessToken,
    clearHeartbeatTimeout,
    clearReconnectTimeout,
    heartbeatInterval,
    maxReconnectAttempts,
    protocols,
    reconnectInterval,
    resolveConnectionError,
    url,
  ]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearHeartbeatTimeout();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, [clearHeartbeatTimeout, clearReconnectTimeout]);

  const sendMessage = useCallback((type: string, data: any) => {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(message);
      console.log('Message queued (not connected):', message);
    }
  }, []);

  const handleBookingUpdate = useCallback((data: any) => {
    // Handle booking status updates
    const { bookingId, status, previousStatus } = data;
    
    switch (status) {
      case 'confirmed':
        toast.success(`Booking ${bookingId} has been confirmed!`);
        break;
      case 'cancelled':
        toast.error(`Booking ${bookingId} has been cancelled`);
        break;
      case 'completed':
        toast.success(`Booking ${bookingId} has been completed`);
        break;
      case 'payment_failed':
        toast.error(`Payment failed for booking ${bookingId}`);
        break;
      default:
        toast.info(`Booking ${bookingId} status updated to ${status}`);
    }

    dispatchBookingUpdate({
      bookingId,
      status,
      previousStatus,
    });
  }, [dispatchBookingUpdate]);

  const handleMessageNotification = useCallback((data: any) => {
    const { messageId, senderName, message } = data;
    const preview =
      typeof message === 'string' && message.length > 50
        ? `${message.substring(0, 50)}...`
        : message;
    toast.info(`New message from ${senderName}: ${preview}`);
  }, []);

  const handleSystemNotification = useCallback((data: any) => {
    const { title, message, severity } = data;
    
    switch (severity) {
      case 'info':
        toast.info(`${title}: ${message}`);
        break;
      case 'warning':
        toast.warning(`${title}: ${message}`);
        break;
      case 'error':
        toast.error(`${title}: ${message}`);
        break;
      default:
        toast.info(`${title}: ${message}`);
    }
  }, []);

  const handlePriceAlert = useCallback((data: any) => {
    const { listingId, listingTitle, newPrice, oldPrice } = data;
    toast.info(`Price drop for ${listingTitle}: ${oldPrice} → ${newPrice}`);
  }, []);

  // Auto-connect when component mounts
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      clearHeartbeatTimeout();
    };
  }, [clearHeartbeatTimeout, clearReconnectTimeout]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connectionStatus,
    error
  };
}

// Hook for booking-specific real-time updates
export function useBookingWebSocket(bookingId: string) {
  const config: WebSocketConfig = {
    url: `${WS_BASE_URL}/bookings/${bookingId}`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}

// Hook for global notifications
export function useNotificationWebSocket() {
  const config: WebSocketConfig = {
    url: `${WS_BASE_URL}/notifications`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}

// Hook for messaging
export function useMessagingWebSocket(conversationId?: string) {
  const wsUrl = conversationId 
    ? `${WS_BASE_URL}/messages/${conversationId}`
    : `${WS_BASE_URL}/messages`;

  const config: WebSocketConfig = {
    url: wsUrl,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}
