import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/TabNavigator";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { BookingSummary } from '~/types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:                    { bg: "#FEF9C3", text: "#854D0E", label: "Pending" },
  PENDING_OWNER_APPROVAL:     { bg: "#FEF9C3", text: "#854D0E", label: "Awaiting Approval" },
  PENDING_PAYMENT:            { bg: "#FEF3C7", text: "#92400E", label: "Awaiting Payment" },
  CONFIRMED:                  { bg: "#DCFCE7", text: "#166534", label: "Confirmed" },
  IN_PROGRESS:                { bg: "#DBEAFE", text: "#1E40AF", label: "In Progress" },
  AWAITING_RETURN_INSPECTION: { bg: "#E0E7FF", text: "#3730A3", label: "Return Requested" },
  COMPLETED:                  { bg: "#F3F4F6", text: "#374151", label: "Completed" },
  SETTLED:                    { bg: "#F3F4F6", text: "#374151", label: "Settled" },
  CANCELLED:                  { bg: "#FEE2E2", text: "#991B1B", label: "Cancelled" },
  DISPUTED:                   { bg: "#FEE2E2", text: "#991B1B", label: "Disputed" },
};


type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'BookingsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

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
          { value: "PENDING_OWNER_APPROVAL", label: "Pending Approval" },
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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchBookings = async () => {
        if (!user) return;
        setLoading(true);
        try {
          const response =
            view === "owner"
              ? await mobileClient.getHostBookings()
              : await mobileClient.getMyBookings();
          if (!isMounted) return;
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
          if (!isMounted) return;
          setBookings([]);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchBookings();
      
      return () => {
        isMounted = false;
      };
    }, [user, view, statusFilter])
  );

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
        renderItem={({ item }) => {
          const statusKey = (item.status || "").toUpperCase();
          const statusStyle = STATUS_COLORS[statusKey] ?? { bg: "#F3F4F6", text: "#374151", label: statusKey };
          const listingImage = (item.listing as any)?.images?.[0] ?? (item.listing as any)?.photos?.[0];

          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}
            >
              <View style={styles.cardRow}>
                {listingImage ? (
                  <Image source={{ uri: listingImage }} style={styles.listingThumb} />
                ) : (
                  <View style={[styles.listingThumb, styles.listingThumbPlaceholder]}>
                    <Text style={styles.thumbPlaceholderText}>📦</Text>
                  </View>
                )}
                <View style={styles.cardContent}>
                  <Text style={styles.title} numberOfLines={1}>{item.listing?.title || "Booking"}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                  <Text style={styles.subtitle}>
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </Text>
                  {(item.totalAmount != null || item.totalPrice != null) && (
                    <Text style={styles.amount}>
                      {formatCurrency(item.totalAmount ?? item.totalPrice)}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>
                {view === "owner" ? "No listing bookings yet" : "No bookings yet"}
              </Text>
              <Text style={styles.emptyHint}>
                {view === "owner"
                  ? "When renters book your listings, they will appear here."
                  : "Find something to rent and make your first booking."}
              </Text>
              {view === "renter" && (
                <Pressable
                  style={styles.emptyAction}
                  onPress={() => navigation.navigate("SearchTab", {})}
                  accessibilityRole="button"
                  accessibilityLabel="Browse listings"
                >
                  <Text style={styles.emptyActionText}>Browse Listings</Text>
                </Pressable>
              )}
            </View>
          }
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
  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAction: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  listingThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  listingThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderText: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  amount: {
    marginTop: 2,
    fontWeight: "700",
    color: "#111827",
    fontSize: 13,
  },
  title: {
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    color: "#6B7280",
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
