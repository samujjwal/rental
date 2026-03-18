import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useWebSocket, useBookingWebSocket, useNotificationWebSocket } from '~/hooks/useWebSocket';
import { useAuthStore } from '~/lib/store/auth';
import { toast } from '~/lib/toast';

// Mock dependencies
vi.mock('~/lib/store/auth');
vi.mock('~/lib/toast');

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  protocols: string[];
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string, protocols?: string[]) {
    this.url = url;
    this.protocols = protocols || [];
    MockWebSocket.instances.push(this);
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1006 }));
    }
  }
}

// Mock global WebSocket
vi.stubGlobal('WebSocket', MockWebSocket);

const getLatestSocket = () => {
  const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!socket) {
    throw new Error('Expected a WebSocket instance to exist');
  }
  return socket;
};

describe('useWebSocket', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    accessToken: 'test-token'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      accessToken: 'test-token'
    } as any);
  });

  it('connects to WebSocket on mount', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    expect(result.current.connectionStatus).toBe('connecting');

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('includes authentication token in URL', () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    renderHook(() => useWebSocket(config));

    // Check if WebSocket was created with token
    expect(getLatestSocket().url).toBe(
      'ws://localhost:3001/test?token=test-token'
    );
  });

  it('sends messages when connected', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.sendMessage('test_type', { data: 'test' });
    });

    // Check if message was sent
    const ws = getLatestSocket();
    expect(ws.sentMessages).toHaveLength(1);
    const sentMessage = JSON.parse(ws.sentMessages[0]);
    expect(sentMessage).toMatchObject({
      type: 'test_type',
      data: { data: 'test' },
    });
    expect(sentMessage.timestamp).toEqual(expect.any(Number));
    expect(sentMessage.id).toEqual(expect.any(String));
  });

  it('queues messages when not connected', () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    // Send message before connection is established
    act(() => {
      result.current.sendMessage('test_type', { data: 'test' });
    });

    // Should not be sent yet
    const ws = getLatestSocket();
    expect(ws.sentMessages).toHaveLength(0);
  });

  it('handles booking update messages', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    act(() => {
      ws.simulateMessage({
        type: 'booking_update',
        data: {
          bookingId: 'booking-123',
          status: 'confirmed',
          previousStatus: 'pending'
        }
      });
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Booking booking-123 has been confirmed!'
    );
  });

  it('handles message notifications', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    act(() => {
      ws.simulateMessage({
        type: 'message_notification',
        data: {
          messageId: 'msg-123',
          senderName: 'John Doe',
          message: 'Hello there!'
        }
      });
    });

    expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
      'New message from John Doe: Hello there!'
    );
  });

  it('handles system notifications', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    act(() => {
      ws.simulateMessage({
        type: 'system_notification',
        data: {
          title: 'System Update',
          message: 'System will be down for maintenance',
          severity: 'warning'
        }
      });
    });

    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
      'System Update: System will be down for maintenance'
    );
  });

  it('handles price alerts', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    act(() => {
      ws.simulateMessage({
        type: 'price_alert',
        data: {
          listingId: 'listing-123',
          listingTitle: 'Camera Rental',
          newPrice: 4500,
          oldPrice: 5000
        }
      });
    });

    expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
      'Price drop for Camera Rental: 5000 → 4500'
    );
  });

  it('updates last message', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    const testMessage = {
      type: 'test',
      data: { test: 'data' },
      timestamp: Date.now(),
      id: 'test-id'
    };
    
    act(() => {
      ws.simulateMessage(testMessage);
    });

    expect(result.current.lastMessage).toEqual(testMessage);
  });

  it('handles connection errors', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 0,
      heartbeatInterval: 1000
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    act(() => {
      ws.simulateError();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect([
        'Connection error',
        'Failed to connect after multiple attempts',
      ]).toContain(result.current.error);
      expect(['connecting', 'reconnecting', 'disconnected', 'error']).toContain(
        result.current.connectionStatus
      );
    });
  });

  it('sends heartbeat messages', async () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 100
    };

    const { result } = renderHook(() => useWebSocket(config));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = getLatestSocket();
    
    // Wait for heartbeat
    await waitFor(() => {
      const pingMessage = ws.sentMessages.find((msg: string) => 
        JSON.parse(msg).type === 'ping'
      );
      expect(pingMessage).toBeDefined();
    }, { timeout: 500 });
  });

  it('disconnects on unmount', () => {
    const config = {
      url: 'ws://localhost:3001/test',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    };

    const { unmount } = renderHook(() => useWebSocket(config));

    unmount();

    const ws = getLatestSocket();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });
});

describe('useBookingWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
  });

  it('creates booking-specific WebSocket config', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'user-123', accessToken: 'test-token' },
      accessToken: 'test-token'
    } as any);

    renderHook(() => useBookingWebSocket('booking-123'));

    expect(getLatestSocket().url).toBe(
      'ws://localhost:3001/bookings/booking-123?token=test-token'
    );
  });
});

describe('useNotificationWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
  });

  it('creates notification-specific WebSocket config', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'user-123', accessToken: 'test-token' },
      accessToken: 'test-token'
    } as any);

    renderHook(() => useNotificationWebSocket());

    expect(getLatestSocket().url).toBe(
      'ws://localhost:3001/notifications?token=test-token'
    );
  });
});
