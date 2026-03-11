import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import type { ListingDetail, ReviewResponse } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "ProfileView">;

type ProfileUser = {
  id: string;
  firstName?: string;
  lastName?: string | null;
  email?: string;
  profilePhotoUrl?: string | null;
  city?: string | null;
  state?: string | null;
};

export function ProfileViewScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [listings, setListings] = useState<ListingDetail[]>([]);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [tab, setTab] = useState<"listings" | "reviews">("listings");
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const profile = await mobileClient.getUserById(userId);
          const listingsResponse = await mobileClient.getUserListings(userId);
          const reviewsResponse = await mobileClient.getUserReviews(userId, "received");
          setUser(profile);
          setListings(listingsResponse.listings || []);
          setReviews(reviewsResponse.reviews || []);
        } catch (err) {
          setStatus("Unable to load profile.");
        }
      };
      load();
    }, [userId])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {user?.profilePhotoUrl ? (
          <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.heading}>
            {user?.firstName || "User"} {user?.lastName || ""}
          </Text>
          {user?.city ? (
            <Text style={styles.subtitle}>
              {user.city}
              {user.state ? `, ${user.state}` : ""}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, tab === "listings" && styles.tabButtonActive]}
          onPress={() => setTab("listings")}
        >
          <Text style={[styles.tabText, tab === "listings" && styles.tabTextActive]}>
            Listings
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === "reviews" && styles.tabButtonActive]}
          onPress={() => setTab("reviews")}
        >
          <Text style={[styles.tabText, tab === "reviews" && styles.tabTextActive]}>
            Reviews
          </Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {tab === "listings" ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("Listing", { listingId: item.id })}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>
                {item.location?.city || "Location"}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.status}>No listings yet.</Text>}
        />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>Rating: {item.overallRating}</Text>
              {item.comment ? <Text style={styles.subtitle}>{item.comment}</Text> : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.status}>No reviews yet.</Text>}
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
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E5E7EB",
  },
  headerText: {
    flex: 1,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 4,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  tabButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  tabText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  title: {
    fontWeight: "700",
    color: "#111827",
  },
});
