import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { UserStats } from "@rental-portal/mobile-sdk";

export function OwnerDashboardScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await mobileClient.getUserStats();
        setStats(response);
      } catch (err) {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Owner Dashboard</Text>
        <Text style={styles.status}>Sign in to view owner stats.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Owner Dashboard</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : stats ? (
        <View style={styles.card}>
          <Text style={styles.label}>Listings</Text>
          <Text style={styles.value}>{stats.listingsCount}</Text>
          <Text style={styles.label}>Bookings as Owner</Text>
          <Text style={styles.value}>{stats.bookingsAsOwner}</Text>
          <Text style={styles.label}>Bookings as Renter</Text>
          <Text style={styles.value}>{stats.bookingsAsRenter}</Text>
          <Text style={styles.label}>Average Rating</Text>
          <Text style={styles.value}>{stats.averageRating ?? "N/A"}</Text>
          <Text style={styles.label}>Total Reviews</Text>
          <Text style={styles.value}>{stats.totalReviews ?? 0}</Text>
        </View>
      ) : (
        <Text style={styles.status}>No stats available.</Text>
      )}
      <View style={styles.quickRow}>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("OwnerListings")}>
          <Text style={styles.quickText}>Listings</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("OwnerCalendar")}>
          <Text style={styles.quickText}>Calendar</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("OwnerEarnings")}>
          <Text style={styles.quickText}>Earnings</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("OwnerInsights")}>
          <Text style={styles.quickText}>Insights</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("OwnerPerformance")}>
          <Text style={styles.quickText}>Performance</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Payments")}>
          <Text style={styles.quickText}>Payments</Text>
        </Pressable>
      </View>
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
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  label: {
    marginTop: 8,
    color: "#6B7280",
  },
  value: {
    fontWeight: "700",
    color: "#111827",
  },
  status: {
    color: "#6B7280",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  quickButton: {
    backgroundColor: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  quickText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
