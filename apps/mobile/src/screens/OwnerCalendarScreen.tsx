import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { BookingSummary } from '~/types';
import { formatDate } from '../utils/date';

export function OwnerCalendarScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!user) return;
        setLoading(true);
        setStatus("");
        try {
          const data = await mobileClient.getHostBookings();
          const sorted = (data || []).sort((a, b) => {
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          });
          setBookings(sorted);
        } catch (err) {
          setBookings([]);
          setStatus("Unable to load bookings.");
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [user])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Owner Calendar</Text>
      {!user ? (
        <Text style={styles.status}>Sign in to view your calendar.</Text>
      ) : loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.title}>{item.listing?.title || "Listing"}</Text>
                <Text style={styles.meta}>{formatDate(item.startDate)} → {formatDate(item.endDate)}</Text>
                <Text style={styles.meta}>Status: {item.status}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.status}>No bookings yet.</Text>}
          />
        </>
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
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
  },
  title: {
    fontWeight: "600",
    color: "#111827",
  },
  meta: {
    marginTop: 4,
    color: "#6B7280",
  },
  status: {
    color: "#6B7280",
  },
});
