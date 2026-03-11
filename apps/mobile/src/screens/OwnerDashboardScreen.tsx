import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { UserStats } from '~/types';

const STAT_CARDS = [
  { key: "listingsCount",   label: "Listings",    color: "#2563EB", bg: "#DBEAFE", emoji: "🏠" },
  { key: "bookingsAsOwner", label: "Bookings",    color: "#16A34A", bg: "#DCFCE7", emoji: "📅" },
  { key: "totalReviews",    label: "Reviews",     color: "#D97706", bg: "#FEF3C7", emoji: "💬" },
  { key: "averageRating",   label: "Avg. Rating", color: "#7C3AED", bg: "#EDE9FE", emoji: "⭐" },
] as const;

const QUICK_LINKS = [
  { label: "My Listings",  screen: "OwnerListings"   },
  { label: "Calendar",     screen: "OwnerCalendar"   },
  { label: "Earnings",     screen: "OwnerEarnings"   },
  { label: "Insights",     screen: "OwnerInsights"   },
  { label: "Performance",  screen: "OwnerPerformance"},
  { label: "Payments",     screen: "Payments"        },
] as const;

export function OwnerDashboardScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        if (!user) return;
        setLoading(true);
        setError("");
        try {
          const response = await mobileClient.getUserStats();
          setStats(response);
        } catch {
          setError("Unable to load stats.");
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Owner Dashboard</Text>
        <Text style={styles.status}>Sign in to view owner stats.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Owner Dashboard</Text>
      <Text style={styles.subheading}>Welcome back, {user.firstName || "Owner"}</Text>

      {loading ? (
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : stats ? (
        <View style={styles.statsGrid}>
          {STAT_CARDS.map(({ key, label, color, bg, emoji }) => {
            const raw = (stats as unknown as Record<string, unknown>)[key as string];
            const val = typeof raw === "number" ? raw : 0;
            const display =
              key === "averageRating"
                ? val > 0 ? `${val.toFixed(1)} ★` : "—"
                : String(val);
            return (
              <View key={key} style={[styles.statCard, { borderTopColor: color }]}>
                <View style={[styles.statIconBox, { backgroundColor: bg }]}>
                  <Text style={styles.statEmoji}>{emoji}</Text>
                </View>
                <Text style={[styles.statValue, { color }]}>{display}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {QUICK_LINKS.map(({ label, screen }) => (
          <Pressable
            key={screen}
            style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.75 }]}
            onPress={() => navigation.navigate(screen)}
          >
            <Text style={styles.quickText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:      { flex: 1, backgroundColor: "#F9FAFB" },
  container:   { padding: 20, paddingBottom: 40 },
  heading:     { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 2 },
  subheading:  { fontSize: 14, color: "#6B7280", marginBottom: 20 },
  error:       { color: "#DC2626", marginTop: 12 },
  status:      { color: "#6B7280", marginTop: 8 },
  statsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBox:   { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statEmoji:     { fontSize: 18 },
  statValue:     { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel:     { fontSize: 12, color: "#6B7280" },
  sectionTitle:  { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  quickGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard:     { backgroundColor: "#111827", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  quickText:     { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
});
