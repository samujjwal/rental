import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { ListingDetail } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "BookingFlow">;

export function BookingFlowScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [listingId] = useState(route.params?.listingId || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(false);

  useEffect(() => {
    if (!listingId) return;
    const loadListing = async () => {
      setLoadingListing(true);
      try {
        const response = await mobileClient.getListing(listingId);
        setListing(response);
      } catch (err) {
        setListing(null);
      } finally {
        setLoadingListing(false);
      }
    };
    loadListing();
  }, [listingId]);

  const handleCreateBooking = async () => {
    if (!user) {
      setStatus("Sign in to create a booking.");
      return;
    }
    if (!listingId || !startDate || !endDate) {
      setStatus("Listing ID, start date, and end date are required.");
      return;
    }
    if (availability !== "available") {
      setStatus("Please check availability before booking.");
      return;
    }

    setStatus("Creating booking...");
    try {
      const booking = await mobileClient.createBooking({
        listingId,
        startDate,
        endDate,
        guestCount: Number(guestCount),
        message,
      });
      setStatus("Booking created. Redirecting to checkout...");
      navigation.navigate("Checkout", { bookingId: booking.id });
    } catch (err) {
      setStatus("Unable to create booking.");
    }
  };

  const handleCheckAvailability = async () => {
    if (!listingId || !startDate || !endDate) {
      setStatus("Listing ID, start date, and end date are required.");
      return;
    }
    setAvailability("checking");
    setStatus("Checking availability...");
    try {
      const response = await mobileClient.checkAvailability(listingId, startDate, endDate);
      if (response.available) {
        setAvailability("available");
        setStatus("Dates are available.");
      } else {
        setAvailability("unavailable");
        setStatus(response.message || "Selected dates are not available.");
      }
    } catch (err) {
      setAvailability("unavailable");
      setStatus("Unable to check availability.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Book a Listing</Text>
      {loadingListing ? (
        <Text style={styles.status}>Loading listing...</Text>
      ) : listing ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{listing.title}</Text>
          {listing.location?.city ? (
            <Text style={styles.summaryText}>
              {listing.location.city}
              {listing.location.state ? `, ${listing.location.state}` : ""}
            </Text>
          ) : null}
          {listing.pricePerDay != null || listing.basePrice != null ? (
            <Text style={styles.summaryText}>
              ${listing.pricePerDay ?? listing.basePrice}/day
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.status}>Unable to load listing.</Text>
      )}
      <TextInput
        value={startDate}
        onChangeText={(value) => {
          setStartDate(value);
          setAvailability("idle");
          setStatus("");
        }}
        placeholder="Start date (YYYY-MM-DD)"
        style={styles.input}
      />
      <TextInput
        value={endDate}
        onChangeText={(value) => {
          setEndDate(value);
          setAvailability("idle");
          setStatus("");
        }}
        placeholder="End date (YYYY-MM-DD)"
        style={styles.input}
      />
      <TextInput
        value={guestCount}
        onChangeText={setGuestCount}
        placeholder="Guest count"
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Message to host (optional)"
        style={styles.input}
      />
      <Pressable style={styles.secondaryButton} onPress={handleCheckAvailability}>
        <Text style={styles.secondaryButtonText}>
          {availability === "checking" ? "Checking..." : "Check availability"}
        </Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={handleCreateBooking}>
        <Text style={styles.primaryButtonText}>Create booking</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  summary: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  summaryTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  summaryText: {
    color: "#6B7280",
    marginBottom: 2,
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
  secondaryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
});
