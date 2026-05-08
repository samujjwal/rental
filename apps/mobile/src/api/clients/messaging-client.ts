/**
 * Messaging Client
 * 
 * Handles all messaging-related API endpoints:
 * - Conversations
 * - Messages
 * - Read receipts
 */

import type { ConversationSummary, MessageItem } from '~/types';
import { BaseClient } from './base-client';

export class MessagingClient extends BaseClient {
  /**
   * Get all conversations for current user
   */
  async getConversations(): Promise<{ items: ConversationSummary[] }> {
    const response = await this.request<{ conversations: any[] }>('/conversations');
    const items = (response.conversations || []).map((conv: any) => {
      const participants = (conv.participants || []).map((p: any) => {
        const user = p.user || {};
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
        return {
          id: p.userId || user.id,
          name: name || user.email || 'User',
        };
      });

      return {
        id: conv.id,
        lastMessage: conv.lastMessage?.content || '',
        updatedAt: conv.updatedAt,
        participants,
      } as ConversationSummary;
    });

    return { items };
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(conversationId: string): Promise<{
    messages: MessageItem[];
    total: number;
    hasMore: boolean;
  }> {
    return this.request<any>(`/conversations/${conversationId}/messages`);
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(conversationId: string, payload: {
    content: string;
    attachments?: string[];
  }): Promise<MessageItem> {
    return this.request<MessageItem>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Mark a conversation as read
   */
  async markConversationRead(conversationId: string): Promise<{ marked: number }> {
    return this.request<any>(`/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  }

  /**
   * Create a new conversation
   */
  async createConversation(payload: {
    listingId?: string;
    recipientId: string;
    message?: string;
  }): Promise<any> {
    return this.request<any>('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
