import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { Organization } from "@rental-portal/mobile-sdk";

type Props = NativeStackScreenProps<RootStackParamList, "Organizations">;

export function OrganizationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const response = await mobileClient.getOrganizations();
        setOrganizations(response.organizations || []);
      } catch (err) {
        setStatus("Unable to load organizations.");
      }
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Organizations</Text>
        <Text style={styles.status}>Sign in to manage organizations.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Organizations</Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("OrganizationCreate")}>
          <Text style={styles.secondaryButtonText}>Create</Text>
        </Pressable>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={organizations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.logoUrl ? <Image source={{ uri: item.logoUrl }} style={styles.logo} /> : null}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.subtitle}>{item.businessType || "Organization"}</Text>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate("OrganizationSettings", { organizationId: item.id })}
                >
                  <Text style={styles.actionButtonText}>Settings</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate("OrganizationMembers", { organizationId: item.id })}
                >
                  <Text style={styles.actionButtonText}>Members</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No organizations yet.</Text>}
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
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    flexDirection: "row",
    gap: 10,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
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
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
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
