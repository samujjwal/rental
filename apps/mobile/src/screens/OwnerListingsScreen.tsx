import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { ListingDetail } from "@rental-portal/mobile-sdk";

type Props = NativeStackScreenProps<RootStackParamList, "OwnerListings">;

export function OwnerListingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingDetail[]>([]);
  const [status, setStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await mobileClient.getMyListings();
        setListings(data || []);
      } catch (err) {
        setStatus("Unable to load listings.");
      }
    };
    load();
  }, [user]);

  const handleListingAction = async (listingId: string, action: "publish" | "pause" | "activate" | "delete") => {
    setActionLoadingId(listingId);
    setActionStatus("");
    try {
      if (action === "publish") await mobileClient.publishListing(listingId);
      if (action === "pause") await mobileClient.pauseListing(listingId);
      if (action === "activate") await mobileClient.activateListing(listingId);
      if (action === "delete") await mobileClient.deleteListing(listingId);
      const refreshed = await mobileClient.getMyListings();
      setListings(refreshed || []);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionStatus("Unable to update listing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My Listings</Text>
        <Text style={styles.status}>Sign in to manage listings.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Listings</Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("CreateListing")}>
          <Text style={styles.secondaryButtonText}>New</Text>
        </Pressable>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {actionStatus ? <Text style={styles.status}>{actionStatus}</Text> : null}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.images?.[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>
                  {(item.title || "Listing").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>
                {item.location?.city || "Location"}
              </Text>
              {item.status ? (
                <Text style={styles.statusTag}>Status: {item.status}</Text>
              ) : null}
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate("Listing", { listingId: item.id })}
                >
                  <Text style={styles.actionText}>View</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate("EditListing", { listingId: item.id })}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                {item.status === "AVAILABLE" ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleListingAction(item.id, "pause")}
                    disabled={actionLoadingId === item.id}
                  >
                    <Text style={styles.actionText}>Pause</Text>
                  </Pressable>
                ) : null}
                {item.status === "UNAVAILABLE" ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleListingAction(item.id, "activate")}
                    disabled={actionLoadingId === item.id}
                  >
                    <Text style={styles.actionText}>Activate</Text>
                  </Pressable>
                ) : null}
                {item.status === "DRAFT" ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleListingAction(item.id, "publish")}
                    disabled={actionLoadingId === item.id}
                  >
                    <Text style={styles.actionText}>Publish</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    if (confirmDeleteId !== item.id) {
                      setConfirmDeleteId(item.id);
                    } else {
                      handleListingAction(item.id, "delete");
                    }
                  }}
                  disabled={actionLoadingId === item.id}
                >
                  <Text style={styles.deleteText}>
                    {confirmDeleteId === item.id ? "Confirm" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No listings yet.</Text>}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
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
    gap: 10,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    fontWeight: "700",
    color: "#6B7280",
  },
  cardBody: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 4,
  },
  statusTag: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  deleteText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
});
