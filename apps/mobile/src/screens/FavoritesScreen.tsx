import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { ListingDetail } from "@rental-portal/mobile-sdk";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<ListingDetail[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await mobileClient.getFavorites();
        setFavorites(data || []);
      } catch (err) {
        setStatus("Unable to load favorites.");
      }
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return favorites;
    return favorites.filter((listing) =>
      (listing.title || "").toLowerCase().includes(lower) ||
      (listing.location?.city || "").toLowerCase().includes(lower) ||
      (listing.location?.state || "").toLowerCase().includes(lower)
    );
  }, [favorites, query]);

  const handleRemove = async (listingId: string) => {
    try {
      await mobileClient.removeFavorite(listingId);
      setFavorites((prev) => prev.filter((item) => item.id !== listingId));
    } catch (err) {
      setStatus("Unable to remove favorite.");
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Favorites</Text>
        <Text style={styles.status}>Sign in to view favorites.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Favorites</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search favorites..."
        style={styles.input}
      />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.images?.[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.image} />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>
                {item.location?.city || "Location"} {item.location?.state || ""}
              </Text>
              <Text style={styles.subtitle}>
                {item.basePrice ? `$${item.basePrice}` : "Price"} {item.currency || ""}
              </Text>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate("Listing", { listingId: item.id })}
                >
                  <Text style={styles.secondaryButtonText}>View</Text>
                </Pressable>
                <Pressable style={styles.removeButton} onPress={() => handleRemove(item.id)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No favorites yet.</Text>}
      />
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  image: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    marginRight: 10,
  },
  cardBody: {
    flex: 1,
  },
  title: {
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  removeButtonText: {
    color: "#991B1B",
    fontWeight: "600",
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
