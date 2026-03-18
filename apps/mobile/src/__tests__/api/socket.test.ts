/* ── socket.io-client mock ── */

const mockOn = jest.fn();
const mockOff = jest.fn();
const mockEmit = jest.fn();
const mockDisconnect = jest.fn();
const mockRemoveAllListeners = jest.fn();

let mockConnected = false;

const mockSocketInstance = {
  get connected() { return mockConnected; },
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
  disconnect: mockDisconnect,
  removeAllListeners: mockRemoveAllListeners,
};

const mockIo = jest.fn().mockReturnValue(mockSocketInstance);

jest.mock('socket.io-client', () => ({
  io: (...args: any[]) => mockIo(...args),
}));

const mockGetToken = jest.fn();
jest.mock('../../api/authStore', () => ({
  getToken: (...a: any[]) => mockGetToken(...a),
}));

import {
  connectSocket,
  disconnectSocket,
  getSocket,
  joinConversation,
  leaveConversation,
  sendMessageViaSocket,
  sendTypingIndicator,
  onNewMessage,
  onTypingIndicator,
  onMessagesRead,
  onUnreadCount,
  onSocketStatusChange,
} from '../../api/socket';

beforeEach(() => {
  jest.clearAllMocks();
  mockConnected = false;
  // Reset module-level socket state
  disconnectSocket();
  jest.clearAllMocks(); // clear the disconnect-triggered mocks
});

describe('socket infrastructure', () => {
  describe('connectSocket', () => {
    it('returns null when no token', async () => {
      mockGetToken.mockResolvedValue(null);
      const result = await connectSocket();
      expect(result).toBeNull();
      expect(mockIo).not.toHaveBeenCalled();
    });

    it('creates socket connection with token', async () => {
      mockGetToken.mockResolvedValue('jwt-token-1');
      const result = await connectSocket();
      expect(result).toBe(mockSocketInstance);
      expect(mockIo).toHaveBeenCalledWith(
        expect.stringContaining('/messaging'),
        expect.objectContaining({
          auth: { token: 'jwt-token-1' },
          transports: ['websocket'],
        }),
      );
    });

    it('registers connect/disconnect/error listeners', async () => {
      mockGetToken.mockResolvedValue('jwt-token-1');
      await connectSocket();
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });
  });

  describe('disconnectSocket', () => {
    it('disconnects and cleans up', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      jest.clearAllMocks();

      disconnectSocket();
      expect(mockRemoveAllListeners).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('is safe to call when no socket exists', () => {
      expect(() => disconnectSocket()).not.toThrow();
    });
  });

  describe('getSocket', () => {
    it('returns null before connection', () => {
      expect(getSocket()).toBeNull();
    });

    it('returns socket after connection', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      expect(getSocket()).toBe(mockSocketInstance);
    });
  });

  describe('joinConversation', () => {
    it('emits join_conversation', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      joinConversation('conv-1');
      expect(mockEmit).toHaveBeenCalledWith('join_conversation', { conversationId: 'conv-1' });
    });
  });

  describe('leaveConversation', () => {
    it('emits leave_conversation', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      leaveConversation('conv-1');
      expect(mockEmit).toHaveBeenCalledWith('leave_conversation', { conversationId: 'conv-1' });
    });
  });

  describe('sendMessageViaSocket', () => {
    it('returns false when not connected', () => {
      mockConnected = false;
      const result = sendMessageViaSocket('conv-1', 'Hello');
      expect(result).toBe(false);
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('emits and returns true when connected', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      mockConnected = true;

      const result = sendMessageViaSocket('conv-1', 'Hello', ['img.jpg']);
      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('send_message', {
        conversationId: 'conv-1',
        content: 'Hello',
        attachments: ['img.jpg'],
      });
    });
  });

  describe('sendTypingIndicator', () => {
    it('emits typing event', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      sendTypingIndicator('conv-1', true);
      expect(mockEmit).toHaveBeenCalledWith('typing', { conversationId: 'conv-1', isTyping: true });
    });
  });

  describe('event listeners', () => {
    it('onNewMessage registers and returns cleanup', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      const cb = jest.fn();
      const cleanup = onNewMessage(cb);

      expect(mockOn).toHaveBeenCalledWith('new_message', expect.any(Function));
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockOff).toHaveBeenCalledWith('new_message', expect.any(Function));
    });

    it('onTypingIndicator registers and returns cleanup', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      const cleanup = onTypingIndicator(jest.fn());
      expect(mockOn).toHaveBeenCalledWith('typing', expect.any(Function));
      cleanup();
      expect(mockOff).toHaveBeenCalledWith('typing', expect.any(Function));
    });

    it('onMessagesRead registers and returns cleanup', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      const cleanup = onMessagesRead(jest.fn());
      expect(mockOn).toHaveBeenCalledWith('messages_read', expect.any(Function));
      cleanup();
    });

    it('onUnreadCount registers and returns cleanup', async () => {
      mockGetToken.mockResolvedValue('tok');
      await connectSocket();
      const cleanup = onUnreadCount(jest.fn());
      expect(mockOn).toHaveBeenCalledWith('unread_count', expect.any(Function));
      cleanup();
    });
  });

  describe('onSocketStatusChange', () => {
    it('registers listener and returns cleanup', () => {
      const listener = jest.fn();
      const cleanup = onSocketStatusChange(listener);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('notifies listeners on disconnect', async () => {
      const listener = jest.fn();
      onSocketStatusChange(listener);

      mockGetToken.mockResolvedValue('tok');
      await connectSocket();

      // disconnectSocket should notify 'disconnected'
      disconnectSocket();
      expect(listener).toHaveBeenCalledWith('disconnected');
    });
  });
});
