import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";


type Props = NativeStackScreenProps<RootStackParamList, "EditListing">;

export function EditListingScreen({ route }: Props) {
  const { listingId } = route.params;
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingMode, setBookingMode] = useState<"REQUEST" | "INSTANT">("REQUEST");
  const { user } = useAuth();

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const listing = await mobileClient.getListing(listingId);
        setTitle(listing.title || "");
        setDescription(listing.description || "");
        const basePrice = listing.pricePerDay ?? listing.basePrice;
        setPrice(basePrice != null ? String(basePrice) : "");
        if (listing.bookingMode) {
          const mode = listing.bookingMode.toUpperCase();
          setBookingMode(mode === "INSTANT_BOOK" || mode === "INSTANT" ? "INSTANT" : "REQUEST");
        } else if (listing.instantBooking != null) {
          setBookingMode(listing.instantBooking ? "INSTANT" : "REQUEST");
        }
      } catch (err) {
        setError("Unable to load listing details.");
      }
    };

    fetchListing();
  }, [listingId]);

  const handleSave = async () => {
    if (!user) {
      setError("Sign in to update a listing.");
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      setError("Please enter a valid price.");
      return;
    }
    setLoading(true);
    setError("");
    setStatus("");
    try {
      await mobileClient.updateListing(listingId, {
        title,
        description,
        basePrice: Number(price),
        pricingMode: "DAILY",
        bookingMode,
        categorySpecificData: {},
      });
      setStatus("Saved.");
    } catch (err) {
      setError("Unable to save changes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Edit Listing</Text>
      <Text style={styles.subtitle}>Listing ID: {listingId}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Listing title"
        style={styles.input}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        style={styles.input}
      />
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder="Price per day"
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text style={styles.label}>Booking mode</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[
            styles.toggleButton,
            bookingMode === "REQUEST" && styles.toggleButtonActive,
          ]}
          onPress={() => setBookingMode("REQUEST")}
        >
          <Text
            style={[
              styles.toggleText,
              bookingMode === "REQUEST" && styles.toggleTextActive,
            ]}
          >
            Request
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            bookingMode === "INSTANT" && styles.toggleButtonActive,
          ]}
          onPress={() => setBookingMode("INSTANT")}
        >
          <Text
            style={[
              styles.toggleText,
              bookingMode === "INSTANT" && styles.toggleTextActive,
            ]}
          >
            Instant
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Saving..." : "Save"}
        </Text>
      </Pressable>
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
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 16,
  },
  label: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
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
  error: {
    color: "#DC2626",
    marginBottom: 8,
  },
  status: {
    color: "#6B7280",
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  toggleButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  toggleText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
});
