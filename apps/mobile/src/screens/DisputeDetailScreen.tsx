import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { DisputeDetail } from '~/types';
import { formatCurrency } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, "DisputeDetail">;

export function DisputeDetailScreen({ route, navigation }: Props) {
  const { disputeId } = route.params;
  const { user } = useAuth();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDispute = async () => {
    try {
      setLoading(true);
      const detail = await mobileClient.getDisputeById(disputeId);
      setDispute(detail);
      setStatus("");
    } catch (err) {
      setStatus("Unable to load dispute details.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDispute();
    }, [disputeId])
  );

  const handleRespond = async () => {
    if (!message.trim()) return;
    try {
      setSubmitting(true);
      await mobileClient.respondToDispute(disputeId, message.trim());
      setMessage("");
      await loadDispute();
    } catch (err) {
      setStatus("Failed to send response.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!closeReason.trim()) return;
    try {
      setSubmitting(true);
      await mobileClient.closeDispute(disputeId, closeReason.trim());
      setCloseReason("");
      await loadDispute();
    } catch (err) {
      setStatus("Failed to close dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Dispute</Text>
        <Text style={styles.status}>{status || "Dispute not found."}</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusValue = String(dispute.status || "").toUpperCase();
  const canClose =
    (dispute.initiator?.id || dispute.initiatorId) === user?.id &&
    !["CLOSED", "RESOLVED"].includes(statusValue);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{dispute.title || "Dispute"}</Text>
      <Text style={styles.subtitle}>Status: {dispute.status}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <Text style={styles.body}>{dispute.description}</Text>
        <Text style={styles.meta}>
          Booking: {dispute.bookingId}
        </Text>
        {dispute.booking?.listing?.title ? (
          <Text style={styles.meta}>Listing: {dispute.booking.listing.title}</Text>
        ) : null}
        {typeof dispute.amount === "number" ? (
          <Text style={styles.meta}>Amount: {formatCurrency(dispute.amount)}</Text>
        ) : null}
        <Text style={styles.meta}>Initiator: {dispute.initiator?.email || "Unknown"}</Text>
        <Text style={styles.meta}>Defendant: {dispute.defendant?.email || "Unknown"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversation</Text>
        {dispute.responses && dispute.responses.length > 0 ? (
          dispute.responses.map((response) => (
            <View key={response.id} style={styles.responseItem}>
              <Text style={styles.responseMeta}>
                {response.user?.email || "System"} • {new Date(response.createdAt).toLocaleString('en')}
              </Text>
              <Text style={styles.body}>{response.content}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.status}>No responses yet.</Text>
        )}

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Add a response"
          multiline
        />
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleRespond}
          disabled={submitting || !message.trim()}
        >
          <Text style={styles.primaryButtonText}>Send Response</Text>
        </Pressable>
      </View>

      {canClose ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Close Dispute</Text>
          <TextInput
            style={styles.input}
            value={closeReason}
            onChangeText={setCloseReason}
            placeholder="Reason for closing"
            multiline
          />
          <Pressable
            style={[styles.destructiveButton, submitting && styles.buttonDisabled]}
            onPress={handleClose}
            disabled={submitting || !closeReason.trim()}
          >
            <Text style={styles.primaryButtonText}>Close Dispute</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 12,
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  body: {
    color: "#111827",
    marginBottom: 6,
  },
  meta: {
    color: "#6B7280",
    marginTop: 2,
  },
  responseItem: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    marginTop: 10,
  },
  responseMeta: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  destructiveButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
