import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/TabNavigator";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";
import type { UserProfile } from '~/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'ProfileTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  owner:  { label: "Owner",  color: "#1D4ED8", bg: "#DBEAFE" },
  renter: { label: "Renter", color: "#047857", bg: "#D1FAE5" },
  admin:  { label: "Admin",  color: "#7C3AED", bg: "#EDE9FE" },
};

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let isMounted = true;
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const response = await mobileClient.getProfile();
          if (isMounted) {
            setProfile(response);
          }
        } catch {
          if (isMounted) {
            setProfile(null);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      fetchProfile();
      
      return () => {
        isMounted = false;
      };
    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.message}>Sign in to view your profile.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Login")} accessibilityLabel="Sign In" accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const firstName = profile?.firstName || user.firstName || "";
  const lastName  = profile?.lastName  || user.lastName  || "";
  const email     = profile?.email     || user.email     || "";
  const avatar    = (profile as any)?.avatar || (user as any)?.avatar;
  const initials  = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase() || email[0]?.toUpperCase() || "U";
  const roleKey   = (user.role || "renter").toLowerCase();
  const roleConf  = ROLE_LABELS[roleKey] ?? ROLE_LABELS.renter;
  const rating    = (profile as any)?.rating;
  const reviewCount = (profile as any)?.totalReviews ?? (profile as any)?.reviewCount;

  const ownerMenuItems = roleKey === "owner"
    ? [
        { label: "My Listings",    screen: "OwnerListings",   params: {} as Record<string, unknown> },
        { label: "Create Listing", screen: "CreateListing",   params: {} as Record<string, unknown> },
      ]
    : [
        { label: "Become an Owner", screen: "BecomeOwner",    params: {} as Record<string, unknown> },
      ];

  const MENU_ITEMS = [
    { label: "Public Profile",    screen: "ProfileView",          params: { userId: user.id } as Record<string, unknown> },
    { label: "My Favorites",      screen: "Favorites",            params: {} as Record<string, unknown> },
    { label: "Edit Profile",      screen: "SettingsProfile",      params: {} as Record<string, unknown> },
    ...ownerMenuItems,
    { label: "Notifications",     screen: "SettingsNotifications",params: {} as Record<string, unknown> },
    { label: "Settings",          screen: "Settings",             params: {} as Record<string, unknown> },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {loading && <ActivityIndicator size="small" color="#2563EB" style={{ marginBottom: 16 }} />}

      {/* Avatar hero */}
      <View style={styles.heroCard}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <Text style={styles.displayName}>{firstName} {lastName}</Text>
        <Text style={styles.emailText}>{email}</Text>
        <View style={styles.rowCenter}>
          <View style={[styles.roleBadge, { backgroundColor: roleConf.bg }]}>
            <Text style={[styles.roleText, { color: roleConf.color }]}>{roleConf.label}</Text>
          </View>
          {rating != null && Number(rating) > 0 && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {Number(rating).toFixed(1)}</Text>
              {reviewCount != null && (
                <Text style={styles.reviewCount}> ({reviewCount})</Text>
              )}
            </View>
          )}
        </View>
        {(profile as any)?.city && (
          <Text style={styles.locationText}>
            📍 {(profile as any).city}{(profile as any).state ? `, ${(profile as any).state}` : ""}
          </Text>
        )}
      </View>

      {/* Menu items */}
      <View style={styles.menuSection}>
        {MENU_ITEMS.map(({ label, screen, params }) => (
          <Pressable
            key={screen}
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: "#F3F4F6" }]}
            onPress={() => navigation.navigate(screen as any, params as any)}
            accessibilityLabel={label}
            accessibilityRole="button"
          >
            <Text style={styles.menuLabel}>{label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Sign Out */}
      <Pressable style={styles.signOutButton} onPress={signOut} accessibilityLabel="Sign Out" accessibilityRole="button">
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: "#F9FAFB" },
  container:    { padding: 20, paddingBottom: 40 },
  heading:      { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  message:      { color: "#6B7280", marginBottom: 12 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarInitials: { fontSize: 28, fontWeight: "800", color: "#1D4ED8" },
  displayName:    { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 2 },
  emailText:      { fontSize: 13, color: "#6B7280", marginBottom: 10 },
  rowCenter:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  roleBadge:      { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  roleText:       { fontSize: 12, fontWeight: "700" },
  ratingBadge:    { flexDirection: "row", alignItems: "center" },
  ratingText:     { fontSize: 13, fontWeight: "600", color: "#111827" },
  reviewCount:    { fontSize: 12, color: "#6B7280" },
  locationText:   { fontSize: 13, color: "#6B7280", marginTop: 4 },
  menuSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuLabel:    { fontSize: 15, color: "#111827", fontWeight: "500" },
  menuChevron:  { fontSize: 20, color: "#9CA3AF" },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "600" },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  signOutText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
});
