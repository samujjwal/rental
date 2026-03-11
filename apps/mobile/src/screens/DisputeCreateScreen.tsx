import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { DisputeType } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "DisputeCreate">;

const DISPUTE_TYPES: { value: DisputeType; label: string }[] = [
  { value: DisputeType.PROPERTY_DAMAGE, label: "Property Damage" },
  { value: DisputeType.MISSING_ITEMS, label: "Missing Items" },
  { value: DisputeType.CONDITION_MISMATCH, label: "Condition Mismatch" },
  { value: DisputeType.REFUND_REQUEST, label: "Refund Request" },
  { value: DisputeType.PAYMENT_ISSUE, label: "Payment Issue" },
  { value: DisputeType.CANCELLATION, label: "Cancellation" },
  { value: DisputeType.CLEANING_FEE, label: "Cleaning Fee" },
  { value: DisputeType.RULES_VIOLATION, label: "Rules Violation" },
  { value: DisputeType.OTHER, label: "Other" },
];

export function DisputeCreateScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const [selectedType, setSelectedType] = useState<DisputeType>(DisputeType.PROPERTY_DAMAGE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingSummary, setBookingSummary] = useState<string>("");

  useEffect(() => {
    const loadBooking = async () => {
      try {
        const booking = await mobileClient.getBooking(bookingId);
        setBookingSummary(booking.listing?.title || booking.id);
      } catch (err) {
        setBookingSummary("");
      }
    };
    loadBooking();
  }, [bookingId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setStatus("Please add a title.");
      return;
    }
    if (!description.trim()) {
      setStatus("Please add a description.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const dispute = await mobileClient.createDispute({
        bookingId,
        type: selectedType,
        title: title.trim(),
        description: description.trim(),
        amount: requestedAmount ? Number(requestedAmount) : undefined,
      });
      setStatus("Dispute submitted.");
      navigation.navigate("DisputeDetail", { disputeId: dispute.id });
    } catch (err) {
      setStatus("Unable to submit dispute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>File a Dispute</Text>
      <Text style={styles.subtitle}>
        Booking: {bookingSummary || bookingId}
      </Text>

      <Text style={styles.label}>Dispute type</Text>
      <View style={styles.typeRow}>
        {DISPUTE_TYPES.map((type) => (
          <Pressable
            key={type.value}
            style={[
              styles.typeChip,
              selectedType === type.value && styles.typeChipActive,
            ]}
            onPress={() => setSelectedType(type.value)}
          >
            <Text
              style={[
                styles.typeText,
                selectedType === type.value && styles.typeTextActive,
              ]}
            >
              {type.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Dispute title"
        style={styles.input}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue"
        style={styles.input}
        multiline
      />
      <TextInput
        value={requestedAmount}
        onChangeText={setRequestedAmount}
        placeholder="Requested amount (optional)"
        keyboardType="number-pad"
        style={styles.input}
      />
      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Submitting..." : "Submit dispute"}
        </Text>
      </Pressable>
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
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 12,
  },
  label: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  typeChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  typeText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  typeTextActive: {
    color: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
});
