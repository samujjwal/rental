import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { UserStats } from '~/types';

export function OwnerPerformanceScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!user) return;
        setLoading(true);
        setStatus("");
        try {
          const data = await mobileClient.getUserStats();
          setStats(data);
        } catch (err) {
          setStatus("Unable to load performance data.");
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [user])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Owner Performance</Text>
      {!user ? (
        <Text style={styles.status}>Sign in to view performance.</Text>
      ) : loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : stats ? (
        <View style={styles.card}>
          <Text style={styles.label}>Response Rate</Text>
          <Text style={styles.value}>{stats.responseRate ?? "N/A"}</Text>
          <Text style={styles.label}>Response Time (hrs)</Text>
          <Text style={styles.value}>{stats.responseTime ?? "N/A"}</Text>
          <Text style={styles.label}>Reviews Received</Text>
          <Text style={styles.value}>{stats.reviewsReceived ?? 0}</Text>
          <Text style={styles.label}>Average Rating</Text>
          <Text style={styles.value}>{stats.averageRating ?? "N/A"}</Text>
        </View>
      ) : (
        <Text style={styles.status}>{status || "No performance data."}</Text>
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
