import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { UserStats } from "@rental-portal/mobile-sdk";

export function OwnerInsightsScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setStatus("");
      try {
        const data = await mobileClient.getUserStats();
        setStats(data);
      } catch (err) {
        setStatus("Unable to load insights.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Owner Insights</Text>
      {!user ? (
        <Text style={styles.status}>Sign in to view insights.</Text>
      ) : loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : stats ? (
        <View style={styles.card}>
          <Text style={styles.label}>Listings</Text>
          <Text style={styles.value}>{stats.listingsCount}</Text>
          <Text style={styles.label}>Bookings as Owner</Text>
          <Text style={styles.value}>{stats.bookingsAsOwner}</Text>
          <Text style={styles.label}>Average Rating</Text>
          <Text style={styles.value}>{stats.averageRating ?? "N/A"}</Text>
          <Text style={styles.label}>Total Reviews</Text>
          <Text style={styles.value}>{stats.totalReviews ?? 0}</Text>
          <Text style={styles.label}>Response Rate</Text>
          <Text style={styles.value}>{stats.responseRate ?? "N/A"}</Text>
          <Text style={styles.label}>Response Time (hrs)</Text>
          <Text style={styles.value}>{stats.responseTime ?? "N/A"}</Text>
        </View>
      ) : (
        <Text style={styles.status}>{status || "No insights available."}</Text>
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
});
