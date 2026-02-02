import { api } from "~/lib/api-client";

export interface ConversationParticipant {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    profilePhotoUrl: string | null;
  };
}

export interface Conversation {
  id: string;
  listingId: string;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  listing?: {
    id: string;
    title: string;
    images: string[];
  };
  lastMessage?: Message | null;
  _count?: {
    messages: number;
  };
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  readReceipts?: {
    userId: string;
    readAt: string;
  }[];
}

export interface CreateConversationDto {
  listingId: string;
  participantId: string;
}

export interface SendMessageDto {
  content: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

export const messagingApi = {
  /**
   * Create a new conversation or get existing one
   */
  async createConversation(data: CreateConversationDto): Promise<Conversation> {
    return api.post<Conversation>("/conversations", data);
  },

  /**
   * Get all conversations for the current user
   */
  async getConversations(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ConversationsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.search) queryParams.append("search", params.search);

    const query = queryParams.toString();
    return api.get<ConversationsResponse>(
      `/conversations${query ? `?${query}` : ""}`
    );
  },

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return api.get<Conversation>(`/conversations/${conversationId}`);
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    params?: {
      page?: number;
      limit?: number;
      before?: string;
    }
  ): Promise<MessagesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.before) queryParams.append("before", params.before);

    const query = queryParams.toString();
    return api.get<MessagesResponse>(
      `/conversations/${conversationId}/messages${query ? `?${query}` : ""}`
    );
  },

  /**
   * Send a message in a conversation
   * Note: This typically goes through WebSocket, but fallback to HTTP
   */
  async sendMessage(
    conversationId: string,
    data: SendMessageDto
  ): Promise<Message> {
    return api.post<Message>(
      `/conversations/${conversationId}/messages`,
      data
    );
  },

  /**
   * Mark all messages in a conversation as read
   */
  async markAsRead(conversationId: string): Promise<{ marked: number }> {
    return api.post<{ marked: number }>(
      `/conversations/${conversationId}/read`
    );
  },

  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/conversations/unread-count");
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    return api.delete<void>(`/conversations/${conversationId}`);
  },

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    return api.delete<void>(`/conversations/messages/${messageId}`);
  },
};
