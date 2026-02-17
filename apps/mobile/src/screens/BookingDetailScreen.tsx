import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { BookingDetail } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState("");

  const fetchBooking = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await mobileClient.getBooking(bookingId);
      setBooking(response);
    } catch (err) {
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [bookingId, user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Booking</Text>
        <Text style={styles.status}>Sign in to view booking details.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#111827" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Booking</Text>
        <Text style={styles.status}>Booking not found.</Text>
      </View>
    );
  }

  const imageUrl = booking.listing?.images?.[0] || booking.listing?.photos?.[0];
  const normalizedStatus = (booking.status || "").toUpperCase();
  const isOwner = booking.ownerId && user?.id ? booking.ownerId === user.id : false;
  const isRenter = booking.renterId && user?.id ? booking.renterId === user.id : !isOwner;

  const canConfirm = isOwner && normalizedStatus === "PENDING_OWNER_APPROVAL";
  const canCancel = normalizedStatus === "CONFIRMED";
  const canStart = isOwner && normalizedStatus === "CONFIRMED";
  const canRequestReturn = isRenter && ["IN_PROGRESS", "ACTIVE"].includes(normalizedStatus);
  const canApproveReturn = isOwner && normalizedStatus === "AWAITING_RETURN_INSPECTION";
  const canPay = isRenter && ["PENDING_PAYMENT", "PENDING"].includes(normalizedStatus);
  const canDispute = isRenter && ["CONFIRMED", "IN_PROGRESS", "AWAITING_RETURN_INSPECTION", "COMPLETED", "SETTLED"].includes(normalizedStatus);

  const handleAction = async (action: "approve" | "cancel" | "reject" | "start" | "request-return" | "approve-return") => {
    setActionStatus("");
    try {
      if (action === "approve") await mobileClient.approveBooking(bookingId);
      if (action === "cancel") await mobileClient.cancelBooking(bookingId, "Cancelled via mobile");
      if (action === "reject") await mobileClient.rejectBooking(bookingId, "Declined via mobile");
      if (action === "start") await mobileClient.startBooking(bookingId);
      if (action === "request-return") await mobileClient.requestReturn(bookingId);
      if (action === "approve-return") await mobileClient.approveReturn(bookingId);
      fetchBooking();
    } catch (err) {
      setActionStatus("Unable to update booking.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Booking Details</Text>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
      <Text style={styles.label}>Listing</Text>
      <Text style={styles.value}>{booking.listing?.title || "Listing"}</Text>
      <Text style={styles.label}>Status</Text>
      <Text style={styles.value}>{booking.status}</Text>
      <Text style={styles.label}>Dates</Text>
      <Text style={styles.value}>
        {booking.startDate} → {booking.endDate}
      </Text>
      {booking.totalAmount != null || booking.totalPrice != null ? (
        <>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>
            ${booking.totalAmount ?? booking.totalPrice}
          </Text>
        </>
      ) : null}
      {canPay && (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Checkout", { bookingId })}
        >
          <Text style={styles.secondaryButtonText}>Pay now</Text>
        </Pressable>
      )}
      {canConfirm && (
        <Pressable style={styles.secondaryButton} onPress={() => handleAction("approve")}>
          <Text style={styles.secondaryButtonText}>Approve Booking</Text>
        </Pressable>
      )}
      {isOwner && normalizedStatus === "PENDING_OWNER_APPROVAL" && (
        <Pressable style={styles.cancelButton} onPress={() => handleAction("reject")}>
          <Text style={styles.cancelButtonText}>Decline Booking</Text>
        </Pressable>
      )}
      {canStart && (
        <Pressable style={styles.secondaryButton} onPress={() => handleAction("start")}>
          <Text style={styles.secondaryButtonText}>Start Booking</Text>
        </Pressable>
      )}
      {canRequestReturn && (
        <Pressable style={styles.secondaryButton} onPress={() => handleAction("request-return")}>
          <Text style={styles.secondaryButtonText}>Request Return</Text>
        </Pressable>
      )}
      {canApproveReturn && (
        <Pressable style={styles.secondaryButton} onPress={() => handleAction("approve-return")}>
          <Text style={styles.secondaryButtonText}>Approve Return</Text>
        </Pressable>
      )}
      {canCancel && (
        <Pressable style={styles.cancelButton} onPress={() => handleAction("cancel")}>
          <Text style={styles.cancelButtonText}>Cancel Booking</Text>
        </Pressable>
      )}
      {canDispute && (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("DisputeCreate", { bookingId })}
        >
          <Text style={styles.secondaryButtonText}>File Dispute</Text>
        </Pressable>
      )}
      {actionStatus ? <Text style={styles.status}>{actionStatus}</Text> : null}
  {booking.listing?.id ? (
    <Pressable
      style={styles.primaryButton}
      onPress={() => navigation.navigate("Listing", { listingId: booking.listing!.id })}
    >
      <Text style={styles.primaryButtonText}>View Listing</Text>
    </Pressable>
  ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
  },
  label: {
    marginTop: 8,
    color: "#6B7280",
  },
  value: {
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    color: "#6B7280",
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  cancelButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FEE2E2",
  },
  cancelButtonText: {
    color: "#991B1B",
    fontWeight: "600",
  },
});
