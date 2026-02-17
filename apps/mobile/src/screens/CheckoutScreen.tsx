import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { BookingDetail } from "@rental-portal/mobile-sdk";
import { WEB_BASE_URL } from "../config";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

export function CheckoutScreen({ route }: Props) {
  const [bookingId, setBookingId] = useState(route.params?.bookingId || "");
  const [status, setStatus] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !bookingId) return;
    const load = async () => {
      try {
        const data = await mobileClient.getBooking(bookingId);
        setBooking(data);
      } catch (err) {
        setBooking(null);
      }
    };
    load();
  }, [bookingId, user]);

  const handlePay = async () => {
    if (!user) {
      setStatus("Sign in to complete checkout.");
      return;
    }
    if (!bookingId) {
      setStatus("Booking ID is required.");
      return;
    }

    setStatus("");
    const checkoutUrl = `${WEB_BASE_URL}/checkout/${bookingId}`;
    try {
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (!supported) {
        setStatus("Secure checkout is unavailable on this device.");
        return;
      }
      await Linking.openURL(checkoutUrl);
    } catch (err) {
      setStatus("Unable to open secure checkout.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Checkout</Text>
      {booking ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>
          <Text style={styles.summaryText}>
            {booking.listing?.title || "Listing"}
          </Text>
          <Text style={styles.summaryText}>
            {booking.startDate} → {booking.endDate}
          </Text>
          {booking.totalAmount != null ? (
            <Text style={styles.summaryText}>Total: ${booking.totalAmount}</Text>
          ) : null}
        </View>
      ) : null}
      <Pressable style={styles.primaryButton} onPress={handlePay}>
        <Text style={styles.primaryButtonText}>Open secure checkout</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
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
    marginBottom: 16,
  },
  summary: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  summaryTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  summaryText: {
    color: "#6B7280",
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 12,
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
    marginTop: 10,
    color: "#6B7280",
  },
});
