import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { Dispute } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "Disputes">;

const STATUS_FILTERS = ["ALL", "OPEN", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "CLOSED", "DISMISSED", "WITHDRAWN"];

export function DisputesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const load = async () => {
        try {
          const response = await mobileClient.getMyDisputes(
            statusFilter === "ALL" ? undefined : statusFilter
          );
          setDisputes(response.disputes || []);
        } catch (err) {
          setStatus("Unable to load disputes.");
        }
      };
      load();
    }, [user, statusFilter])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Disputes</Text>
        <Text style={styles.status}>Sign in to view disputes.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Disputes</Text>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterChip,
              statusFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={disputes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("DisputeDetail", { disputeId: item.id })}
          >
            <Text style={styles.title}>{item.title || item.type}</Text>
            <Text style={styles.subtitle}>Status: {item.status}</Text>
            <Text style={styles.subtitle}>{item.description}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.status}>No disputes yet.</Text>}
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
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  filterChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  filterTextActive: {
    color: "#FFFFFF",
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
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 2,
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
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
