import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { BookingSummary } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "Bookings">;

export function BookingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"renter" | "owner">("renter");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const statusOptions =
    view === "owner"
      ? [
          { value: "", label: "All" },
          { value: "PENDING", label: "Pending" },
          { value: "PENDING_OWNER_APPROVAL", label: "Pending" },
          { value: "PENDING_PAYMENT", label: "Pending Payment" },
          { value: "CONFIRMED", label: "Confirmed" },
          { value: "IN_PROGRESS", label: "In Progress" },
          { value: "AWAITING_RETURN_INSPECTION", label: "Return Requested" },
          { value: "COMPLETED", label: "Completed" },
          { value: "SETTLED", label: "Settled" },
          { value: "CANCELLED", label: "Cancelled" },
          { value: "DISPUTED", label: "Disputed" },
        ]
      : [
          { value: "", label: "All" },
          { value: "PENDING", label: "Pending" },
          { value: "PENDING_OWNER_APPROVAL", label: "Pending Approval" },
          { value: "PENDING_PAYMENT", label: "Pending Payment" },
          { value: "CONFIRMED", label: "Confirmed" },
          { value: "IN_PROGRESS", label: "In Progress" },
          { value: "COMPLETED", label: "Completed" },
          { value: "CANCELLED", label: "Cancelled" },
        ];

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response =
          view === "owner"
            ? await mobileClient.getHostBookings()
            : await mobileClient.getMyBookings();
        const normalizeStatus = (status: string) => status.toUpperCase();
        const filtered =
          statusFilter
            ? (response || []).filter((booking) => {
                const statusValue = normalizeStatus(booking.status || "");
                return statusValue === statusFilter.toUpperCase();
              })
            : response || [];
        setBookings(filtered);
      } catch (error) {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user, view, statusFilter]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Bookings</Text>
        <Text style={styles.message}>Sign in to view your bookings.</Text>
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
      <Text style={styles.heading}>
        {view === "owner" ? "My Listings Bookings" : "My Bookings"}
      </Text>
      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.toggleButton, view === "renter" && styles.toggleButtonActive]}
          onPress={() => setView("renter")}
        >
          <Text style={[styles.toggleText, view === "renter" && styles.toggleTextActive]}>
            My Rentals
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, view === "owner" && styles.toggleButtonActive]}
          onPress={() => setView("owner")}
        >
          <Text style={[styles.toggleText, view === "owner" && styles.toggleTextActive]}>
            My Listings
          </Text>
        </Pressable>
      </View>
      <View style={styles.statusRow}>
        {statusOptions.map((option) => (
          <Pressable
            key={option.value || "all"}
            style={[
              styles.statusChip,
              statusFilter === option.value && styles.statusChipActive,
            ]}
            onPress={() => setStatusFilter(option.value)}
          >
            <Text
              style={[
                styles.statusChipText,
                statusFilter === option.value && styles.statusChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}
          >
            <Text style={styles.title}>{item.listing?.title || "Booking"}</Text>
            <Text style={styles.subtitle}>Status: {item.status}</Text>
            <Text style={styles.subtitle}>
              {item.startDate} → {item.endDate}
            </Text>
            {item.totalAmount != null || item.totalPrice != null ? (
              <Text style={styles.subtitle}>
                Total: ${item.totalAmount ?? item.totalPrice}
              </Text>
            ) : null}
          </Pressable>
        )}
          ListEmptyComponent={<Text style={styles.message}>No bookings yet.</Text>}
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
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    overflow: "hidden",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#111827",
  },
  toggleText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  statusChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  statusChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  statusChipTextActive: {
    color: "#FFFFFF",
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
