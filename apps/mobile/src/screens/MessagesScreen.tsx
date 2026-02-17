import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { ConversationSummary } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "Messages">;

export function MessagesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await mobileClient.getConversations();
        setConversations(response.items || []);
      } catch (error) {
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Messages</Text>
        <Text style={styles.message}>Sign in to view your messages.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Messages</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("MessageThread", { conversationId: item.id })}
            >
              <Text style={styles.title}>
                {item.participants?.find((p) => p.id !== user?.id)?.name || "Conversation"}
              </Text>
              <Text style={styles.subtitle}>{item.lastMessage || "No messages yet"}</Text>
              {item.updatedAt && (
                <Text style={styles.meta}>Updated: {item.updatedAt}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.message}>No conversations yet.</Text>}
        />
      )}
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
    marginBottom: 8,
  },
  message: {
    color: "#6B7280",
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    color: "#6B7280",
  },
  meta: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
