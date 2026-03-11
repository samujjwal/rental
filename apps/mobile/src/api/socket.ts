import { io, Socket } from 'socket.io-client';
import { getToken } from './authStore';
import { SOCKET_BASE_URL } from '~/config';

let socket: Socket | null = null;
let currentToken: string | null = null;

// Track registered event handlers so they survive reconnects
const registeredHandlers: Array<{ event: string; callback: (...args: any[]) => void }> = [];

export type SocketStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

type StatusListener = (status: SocketStatus) => void;
const statusListeners = new Set<StatusListener>();

function notifyStatusChange(status: SocketStatus) {
  statusListeners.forEach((listener) => listener(status));
}

export function onSocketStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Connect to the messaging WebSocket namespace.
 * Re-uses existing connection if token hasn't changed.
 */
export async function connectSocket(): Promise<Socket | null> {
  const token = await getToken();
  if (!token) return null;

  // Reuse if already connected with same token
  if (socket?.connected && currentToken === token) {
    return socket;
  }

  // Disconnect old socket if token changed
  disconnectSocket();

  currentToken = token;
  notifyStatusChange('connecting');

  socket = io(`${SOCKET_BASE_URL}/messaging`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    notifyStatusChange('connected');
  });

  socket.on('disconnect', () => {
    notifyStatusChange('disconnected');
  });

  socket.on('connect_error', () => {
    notifyStatusChange('error');
  });

  // Replay all registered handlers on the new socket
  registeredHandlers.forEach(({ event, callback }) => {
    socket?.on(event, callback);
  });

  return socket;
}

/**
 * Disconnect and clean up.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
    notifyStatusChange('disconnected');
  }
}

/**
 * Get current socket instance (may be null).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Join a conversation room.
 */
export function joinConversation(conversationId: string): void {
  socket?.emit('join_conversation', { conversationId });
}

/**
 * Leave a conversation room.
 */
export function leaveConversation(conversationId: string): void {
  socket?.emit('leave_conversation', { conversationId });
}

/**
 * Send a message via WebSocket.
 * Returns true if emitted, false if socket not connected (caller should use HTTP fallback).
 */
export function sendMessageViaSocket(
  conversationId: string,
  content: string,
  attachments?: string[],
): boolean {
  if (!socket?.connected) return false;
  socket.emit('send_message', { conversationId, content, attachments });
  return true;
}

/**
 * Send typing indicator.
 */
export function sendTypingIndicator(conversationId: string, isTyping: boolean): void {
  socket?.emit('typing', { conversationId, isTyping });
}

/**
 * Listen for new messages in any joined conversation.
 */
export function onNewMessage(
  callback: (message: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    attachments?: string[];
  }) => void,
): () => void {
  const handler = (data: any) => callback(data);
  registeredHandlers.push({ event: 'new_message', callback: handler });
  socket?.on('new_message', handler);
  return () => {
    socket?.off('new_message', handler);
    const idx = registeredHandlers.findIndex((h) => h.event === 'new_message' && h.callback === handler);
    if (idx !== -1) registeredHandlers.splice(idx, 1);
  };
}

/**
 * Listen for typing indicators.
 */
export function onTypingIndicator(
  callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void,
): () => void {
  const handler = (data: any) => callback(data);
  registeredHandlers.push({ event: 'typing', callback: handler });
  socket?.on('typing', handler);
  return () => {
    socket?.off('typing', handler);
    const idx = registeredHandlers.findIndex((h) => h.event === 'typing' && h.callback === handler);
    if (idx !== -1) registeredHandlers.splice(idx, 1);
  };
}

/**
 * Listen for messages being read.
 */
export function onMessagesRead(
  callback: (data: { conversationId: string; userId: string }) => void,
): () => void {
  const handler = (data: any) => callback(data);
  registeredHandlers.push({ event: 'messages_read', callback: handler });
  socket?.on('messages_read', handler);
  return () => {
    socket?.off('messages_read', handler);
    const idx = registeredHandlers.findIndex((h) => h.event === 'messages_read' && h.callback === handler);
    if (idx !== -1) registeredHandlers.splice(idx, 1);
  };
}

/**
 * Listen for unread count updates.
 */
export function onUnreadCount(callback: (data: { count: number }) => void): () => void {
  const handler = (data: any) => callback(data);
  registeredHandlers.push({ event: 'unread_count', callback: handler });
  socket?.on('unread_count', handler);
  return () => {
    socket?.off('unread_count', handler);
    const idx = registeredHandlers.findIndex((h) => h.event === 'unread_count' && h.callback === handler);
    if (idx !== -1) registeredHandlers.splice(idx, 1);
  };
}
