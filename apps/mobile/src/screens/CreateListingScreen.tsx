import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { Category } from "@rental-portal/mobile-sdk";

type Props = NativeStackScreenProps<RootStackParamList, "CreateListing">;

export function CreateListingScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [price, setPrice] = useState("");
  const [bookingMode, setBookingMode] = useState<"REQUEST" | "INSTANT">("REQUEST");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await mobileClient.categories();
        setCategories(data || []);
      } catch (err) {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const handleCreate = async () => {
    if (!user) {
      setError("Sign in to create a listing.");
      return;
    }
    if (!title.trim() || !description.trim() || !categoryId || !city.trim() || !state.trim() || !country.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      setError("Please enter a valid price.");
      return;
    }
    if (!lat.trim() || !lon.trim()) {
      setError("Please provide latitude and longitude.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const listing = await mobileClient.createListing({
        categoryId,
        title,
        description,
        city,
        state,
        country,
        latitude: Number(lat),
        longitude: Number(lon),
        pricingMode: "DAILY",
        basePrice: Number(price),
        bookingMode,
        categorySpecificData: {},
        currency: "USD",
      });
      setTitle("");
      setDescription("");
      setCategoryId("");
      setCity("");
      setState("");
      setCountry("");
      setLat("");
      setLon("");
      setPrice("");
      navigation.navigate("Listing", { listingId: listing.id });
    } catch (err) {
      setError("Unable to create listing. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Create Listing</Text>
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
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {categories.length === 0 ? (
          <Text style={styles.helper}>No categories loaded yet.</Text>
        ) : (
          categories.map((category) => (
            <Pressable
              key={category.id}
              style={[
                styles.categoryChip,
                categoryId === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryId(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  categoryId === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))
        )}
      </View>
      {selectedCategory ? (
        <Text style={styles.helper}>Selected: {selectedCategory.name}</Text>
      ) : null}
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="City"
        style={styles.input}
      />
      <TextInput
        value={state}
        onChangeText={setState}
        placeholder="State"
        style={styles.input}
      />
      <TextInput
        value={country}
        onChangeText={setCountry}
        placeholder="Country"
        style={styles.input}
      />
      <TextInput
        value={lat}
        onChangeText={setLat}
        placeholder="Latitude"
        keyboardType="numbers-and-punctuation"
        style={styles.input}
      />
      <TextInput
        value={lon}
        onChangeText={setLon}
        placeholder="Longitude"
        keyboardType="numbers-and-punctuation"
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
      <Pressable style={styles.primaryButton} onPress={handleCreate}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Creating..." : "Create"}
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
  content: {
    paddingBottom: 40,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
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
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  categoryChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  categoryText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  helper: {
    color: "#6B7280",
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
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
