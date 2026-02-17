import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { BookingSummary } from "@rental-portal/mobile-sdk";

type Props = NativeStackScreenProps<RootStackParamList, "RenterDashboard">;

export function RenterDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [stats, setStats] = useState({
    upcoming: 0,
    active: 0,
    completed: 0,
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) {
      setStatus("Sign in to view your dashboard.");
      return;
    }

    const load = async () => {
      try {
        const data = await mobileClient.getMyBookings();
        setBookings(data);
        const now = new Date();
        const normalize = (status: string) => status.toUpperCase();
        const upcoming = data.filter((b) => {
          const status = normalize(b.status || "");
          return status === "CONFIRMED" && new Date(b.startDate) > now;
        }).length;
        const active = data.filter((b) => {
          const status = normalize(b.status || "");
          return status === "IN_PROGRESS" || status === "AWAITING_RETURN_INSPECTION";
        }).length;
        const completed = data.filter((b) => {
          const status = normalize(b.status || "");
          return status === "COMPLETED" || status === "SETTLED";
        }).length;
        setStats({ upcoming, active, completed });
      } catch (err) {
        setStatus("Unable to load dashboard data.");
      }
    };

    load();
  }, [user]);

  const renderBooking = ({ item }: { item: BookingSummary }) => (
    <Pressable
      style={styles.bookingCard}
      onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}
    >
      <Text style={styles.bookingTitle}>{item.listing?.title || "Booking"}</Text>
      <Text style={styles.bookingMeta}>
        {item.startDate} → {item.endDate}
      </Text>
      <Text style={styles.bookingStatus}>{item.status}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Renter Dashboard</Text>
      <Text style={styles.subheading}>Track your bookings and activity.</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Upcoming</Text>
          <Text style={styles.statValue}>{stats.upcoming}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{stats.active}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{stats.completed}</Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Search")}>
          <Text style={styles.quickText}>Search</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Bookings")}>
          <Text style={styles.quickText}>Bookings</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Messages")}>
          <Text style={styles.quickText}>Messages</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Reviews")}>
          <Text style={styles.quickText}>Reviews</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => navigation.navigate("BecomeOwner")}>
          <Text style={styles.quickText}>Become Owner</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Recent bookings</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={bookings.slice(0, 5)}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        ListEmptyComponent={<Text style={styles.status}>No bookings yet.</Text>}
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
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subheading: {
    color: "#6B7280",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  quickButton: {
    backgroundColor: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 10,
  },
  bookingTitle: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  bookingMeta: {
    color: "#6B7280",
    fontSize: 12,
  },
  bookingStatus: {
    marginTop: 6,
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
});
