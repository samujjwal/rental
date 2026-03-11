import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import { ImagePicker, SelectedImage } from "../components/ImagePicker";
import { showSuccess, showError, showApiError } from "../components/Toast";


type Props = NativeStackScreenProps<RootStackParamList, "EditListing">;

export function EditListingScreen({ route }: Props) {
  const { listingId } = route.params;
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingMode, setBookingMode] = useState<"REQUEST" | "INSTANT_BOOK">("REQUEST");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const listing = await mobileClient.getListing(listingId);
        setTitle(listing.title || "");
        setDescription(listing.description || "");
        const basePrice = listing.pricePerDay ?? listing.basePrice;
        setPrice(basePrice != null ? String(basePrice) : "");
        // Load existing photos
        const photos = listing.photos || [];
        setImages(photos.map((uri: string) => ({ uri })));
        if (listing.bookingMode) {
          const mode = listing.bookingMode.toUpperCase();
          setBookingMode(mode === "INSTANT_BOOK" || mode === "INSTANT" ? "INSTANT_BOOK" : "REQUEST");
        } else if (listing.instantBooking != null) {
          setBookingMode(listing.instantBooking ? "INSTANT_BOOK" : "REQUEST");
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
        pricingMode: "PER_DAY",
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>Edit Listing</Text>
      <Text style={styles.subtitle}>Listing ID: {listingId}</Text>
      <ImagePicker
        images={images}
        onImagesChange={setImages}
        maxImages={10}
        label="Photos"
      />
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
        multiline
        numberOfLines={4}
      />
      <Pressable
        style={[styles.aiButton, generatingDesc && styles.aiButtonDisabled]}
        onPress={async () => {
          if (!title.trim()) {
            showError('Enter a title first');
            return;
          }
          setGeneratingDesc(true);
          try {
            const result = await mobileClient.generateDescription({
              title,
              city: undefined,
            });
            setDescription(result.description);
            showSuccess('Description generated');
          } catch {
            showError('Failed to generate description');
          } finally {
            setGeneratingDesc(false);
          }
        }}
        disabled={generatingDesc}
        accessibilityRole="button"
        accessibilityLabel="Generate description with AI"
      >
        {generatingDesc ? (
          <ActivityIndicator size="small" color="#4A90D9" />
        ) : (
          <Text style={styles.aiButtonText}>{'\u2728'} Generate with AI</Text>
        )}
      </Pressable>
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
            bookingMode === "INSTANT_BOOK" && styles.toggleButtonActive,
          ]}
          onPress={() => setBookingMode("INSTANT_BOOK")}
        >
          <Text
            style={[
              styles.toggleText,
              bookingMode === "INSTANT_BOOK" && styles.toggleTextActive,
            ]}
          >
            Instant
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Saving..." : "Save"}
        </Text>
      </Pressable>
    </ScrollView>
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
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A90D9",
    backgroundColor: "#EFF6FF",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: "#4A90D9",
    fontWeight: "600",
    fontSize: 13,
  },
});
