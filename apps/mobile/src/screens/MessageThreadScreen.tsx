import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, Pressable, Image, Linking } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { MessageItem } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "MessageThread">;

export function MessageThreadScreen({ route }: Props) {
  const { user } = useAuth();
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const isImageUrl = (url: string) => {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".webp")
    );
  };

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;
      setLoading(true);
      try {
      const response = await mobileClient.getConversationMessages(conversationId);
      setMessages(response.messages || []);
      await mobileClient.markConversationRead(conversationId);
      } catch (err) {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId, user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Messages</Text>
        <Text style={styles.status}>Sign in to view this conversation.</Text>
      </View>
    );
  }

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    setStatus("");
    const temp = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      createdAt: new Date().toISOString(),
      senderId: user?.id || "",
    };
    setMessages((prev) => [...prev, temp]);
    setNewMessage("");
    try {
      const sent = await mobileClient.sendMessage(conversationId, {
        content: temp.content,
      });
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? sent : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setStatus("Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Conversation</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>{item.content}</Text>
              {item.attachments && item.attachments.length > 0 ? (
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
                        <Text style={styles.attachmentLinkText}>Open attachment</Text>
                      </Pressable>
                    )
                  )}
                </View>
              ) : null}
              <Text style={styles.messageMeta}>{item.createdAt}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.status}>No messages yet.</Text>}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          style={styles.input}
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Text style={styles.sendButtonText}>{sending ? "..." : "Send"}</Text>
        </Pressable>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  messageBubble: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  messageText: {
    color: "#111827",
  },
  messageMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#9CA3AF",
  },
  attachmentsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  attachmentImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  attachmentLink: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  attachmentLinkText: {
    color: "#111827",
    fontSize: 12,
  },
  status: {
    color: "#6B7280",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  sendButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
