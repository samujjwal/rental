// ============================================================================
// Messaging Types
// Shared contract for messaging data between frontend and backend
// ============================================================================

/** Create conversation input */
export interface CreateConversationInput {
  participantIds: string[];
  listingId?: string;
  bookingId?: string;
  initialMessage?: string;
}

/** Send message input */
export interface SendMessageInput {
  conversationId: string;
  content: string;
  attachments?: MessageAttachment[];
}

/** Message attachment */
export interface MessageAttachment {
  url: string;
  type: string;
  name?: string;
  size?: number;
}

/** Conversation summary */
export interface ConversationSummary {
  id: string;
  participants: ConversationParticipant[];
  lastMessage?: MessageSummary;
  unreadCount: number;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  bookingId?: string;
  updatedAt: string;
}

/** Conversation participant */
export interface ConversationParticipant {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
}

/** Message summary */
export interface MessageSummary {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachments?: MessageAttachment[];
  readBy?: string[];
  createdAt: string;
}

/** Typing indicator event */
export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
