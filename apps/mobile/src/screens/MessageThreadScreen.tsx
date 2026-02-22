import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { mobileClient } from '../api/client';
import { useAuth } from '../api/authContext';
import type { MessageItem } from '@rental-portal/mobile-sdk';
import {
  connectSocket,
  joinConversation,
  leaveConversation,
  sendMessageViaSocket,
  onNewMessage,
  onTypingIndicator,
  sendTypingIndicator,
  SocketStatus,
  onSocketStatusChange,
} from '../api/socket';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { ListSkeleton } from '../components/LoadingSkeleton';
import { showApiError } from '../components/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MessageThread'>;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export function MessageThreadScreen({ route }: Props) {
  const { user } = useAuth();
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect socket and join conversation
  useEffect(() => {
    if (!user) return;

    let cleanupNewMessage: (() => void) | null = null;
    let cleanupTyping: (() => void) | null = null;
    let cleanupStatus: (() => void) | null = null;

    const setup = async () => {
      // Fetch initial messages via HTTP
      try {
        const response = await mobileClient.getConversationMessages(conversationId);
        setMessages(response.messages || []);
        await mobileClient.markConversationRead(conversationId);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }

      // Connect WebSocket
      const socket = await connectSocket();
      if (!socket) return;

      joinConversation(conversationId);

      // Listen for new messages
      cleanupNewMessage = onNewMessage((msg) => {
        setMessages((prev) => {
          // Deduplicate (replace optimistic or skip if already exists)
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Remove temp message if this is ours
          const filtered = prev.filter(
            (m) => !(m.id.startsWith('temp-') && m.senderId === msg.senderId),
          );
          return [...filtered, msg];
        });
        // Scroll to bottom
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      // Listen for typing indicators
      cleanupTyping = onTypingIndicator(({ userId, isTyping }) => {
        if (userId === user.id) return;
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (isTyping) next.add(userId);
          else next.delete(userId);
          return next;
        });
      });

      // Track socket status
      cleanupStatus = onSocketStatusChange(setSocketStatus);
    };

    setup();

    return () => {
      leaveConversation(conversationId);
      cleanupNewMessage?.();
      cleanupTyping?.();
      cleanupStatus?.();
    };
  }, [conversationId, user]);

  // Handle typing indicator debounce
  const handleTextChange = useCallback(
    (text: string) => {
      setNewMessage(text);
      if (text.length > 0) {
        sendTypingIndicator(conversationId, true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          sendTypingIndicator(conversationId, false);
        }, 2000);
      } else {
        sendTypingIndicator(conversationId, false);
      }
    },
    [conversationId],
  );

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || !user) return;

    setSending(true);
    sendTypingIndicator(conversationId, false);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageItem = {
      id: tempId,
      content,
      createdAt: new Date().toISOString(),
      senderId: user.id,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    // Try WebSocket first, fall back to HTTP
    const sent = sendMessageViaSocket(conversationId, content);
    if (!sent) {
      try {
        const result = await mobileClient.sendMessage(conversationId, { content });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result : m)));
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        showApiError(err);
      }
    }
    setSending(false);
  }, [newMessage, user, conversationId]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign In Required</Text>
        <Text style={styles.emptySubtitle}>Sign in to view this conversation.</Text>
      </View>
    );
  }

  const renderMessage = useCallback(
    ({ item }: { item: MessageItem }) => {
      const isOwn = item.senderId === user?.id;
      const isTemp = item.id.startsWith('temp-');
      return (
        <View
          style={[
            styles.bubbleRow,
            isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleOther,
              isTemp && styles.bubbleTemp,
            ]}
          >
            <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
              {item.content}
            </Text>
            {item.attachments && item.attachments.length > 0 && (
              <View style={styles.attachmentsRow}>
                {item.attachments.map((url) =>
                  isImageUrl(url) ? (
                    <Image
                      key={url}
                      source={{ uri: url }}
                      style={styles.attachmentImage}
                    />
                  ) : (
                    <Pressable
                      key={url}
                      onPress={() => Linking.openURL(url)}
                      style={styles.attachmentLink}
                    >
                      <Text style={styles.attachmentLinkText}>Attachment</Text>
                    </Pressable>
                  ),
                )}
              </View>
            )}
            <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
              {formatTime(item.createdAt)}
              {isTemp ? ' \u2022 Sending...' : ''}
            </Text>
          </View>
        </View>
      );
    },
    [user],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Connection status */}
      {socketStatus === 'error' && (
        <View style={styles.statusBar}>
          <Text style={styles.statusBarText}>Connection lost. Messages sent via HTTP.</Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ListSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptySubtitle}>Start the conversation!</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>
            {typingUsers.size === 1 ? 'Someone is typing...' : `${typingUsers.size} people typing...`}
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          value={newMessage}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{'\u2191'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  statusBar: {
    backgroundColor: colors.warningLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  statusBarText: {
    ...typography.caption,
    color: '#92400E',
    fontWeight: '600',
  },
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  bubbleRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    ...shadows.sm,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleTemp: {
    opacity: 0.7,
  },
  bubbleText: {
    ...typography.body,
    color: colors.text,
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  attachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  attachmentImage: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderLight,
  },
  attachmentLink: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  attachmentLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  typingRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typingText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    backgroundColor: colors.input,
    ...typography.body,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
