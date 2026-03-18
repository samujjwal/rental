import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '~/lib/toast';
import { useAuthStore } from '~/lib/store/auth';

const DEFAULT_PROTOCOLS: string[] = [];

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
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000
  } = config;
  const protocols = config.protocols ?? DEFAULT_PROTOCOLS;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      setError(null);

      // Add authentication token to URL if available
      const wsUrl = accessToken 
        ? `${url}?token=${encodeURIComponent(accessToken)}`
        : url;

      const ws = new WebSocket(wsUrl, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send queued messages
        if (messageQueueRef.current.length > 0) {
          messageQueueRef.current.forEach(message => {
            ws.send(JSON.stringify(message));
          });
          messageQueueRef.current = [];
        }

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, heartbeatInterval);

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
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionStatus('error');
          setError('Failed to connect after multiple attempts');
          toast.error('Real-time updates unavailable');
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setIsConnected(false);
        setError('Connection error');
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to create connection');
      setConnectionStatus('error');
    }
  }, [url, protocols, accessToken, reconnectInterval, maxReconnectAttempts, heartbeatInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

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

    // Trigger page refresh if needed
    if (typeof window !== 'undefined' && window.location.pathname.includes('/bookings/')) {
      window.location.reload();
    }
  }, []);

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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

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
    url: `${process.env.WS_URL || 'ws://localhost:3001'}/bookings/${bookingId}`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}

// Hook for global notifications
export function useNotificationWebSocket() {
  const config: WebSocketConfig = {
    url: `${process.env.WS_URL || 'ws://localhost:3001'}/notifications`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}

// Hook for messaging
export function useMessagingWebSocket(conversationId?: string) {
  const wsUrl = conversationId 
    ? `${process.env.WS_URL || 'ws://localhost:3001'}/messages/${conversationId}`
    : `${process.env.WS_URL || 'ws://localhost:3001'}/messages`;

  const config: WebSocketConfig = {
    url: wsUrl,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  };

  return useWebSocket(config);
}
