import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { UserProfile } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.message}>Sign in to view your profile.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await mobileClient.getProfile();
        setProfile(response);
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>
            {profile?.firstName || user.firstName} {profile?.lastName || user.lastName || ""}
          </Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email || user.email}</Text>
          {profile?.city && (
            <>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>
                {profile.city}
                {profile.state ? `, ${profile.state}` : ""}
              </Text>
            </>
          )}
        </View>
      )}
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("ProfileView", { userId: user.id })}>
        <Text style={styles.secondaryButtonText}>Public Profile</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("SettingsProfile")}>
        <Text style={styles.secondaryButtonText}>Edit Profile</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("SettingsNotifications")}>
        <Text style={styles.secondaryButtonText}>Notifications</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Settings")}>
        <Text style={styles.secondaryButtonText}>Settings</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={signOut}>
        <Text style={styles.primaryButtonText}>Sign Out</Text>
      </Pressable>
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
    marginBottom: 16,
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
    fontSize: 12,
  },
  value: {
    color: "#111827",
    fontWeight: "600",
  },
  message: {
    color: "#6B7280",
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
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
});
