import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, TextInput, Pressable } from "react-native";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { NotificationPreferences } from "@rental-portal/mobile-sdk";

export function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("");
  const [status, setStatus] = useState("");
  const { user, signOut } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const [profile, prefs] = await Promise.all([
          mobileClient.getProfile(),
          mobileClient.getNotificationPreferences(),
        ]);
        setPreferredLanguage(profile.preferredLanguage || "en");
        setPreferredCurrency(profile.preferredCurrency || "USD");
        setTimezone(profile.timezone || "");
        setNotifications(Boolean(prefs.push));
        setEmailUpdates(Boolean(prefs.email));
      } catch (err) {
        setStatus("Unable to load settings.");
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      setStatus("Sign in to update settings.");
      return;
    }
    setStatus("Saving...");
    try {
      const updatePrefs: Partial<NotificationPreferences> = {
        push: notifications,
        email: emailUpdates,
      };
      await Promise.all([
        mobileClient.updateProfile({
          preferredLanguage,
          preferredCurrency,
          timezone,
        }),
        mobileClient.updateNotificationPreferences(updatePrefs),
      ]);
      setStatus("Saved.");
    } catch (err) {
      setStatus("Unable to save settings.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.section}>Preferences</Text>
      <TextInput
        value={preferredLanguage}
        onChangeText={setPreferredLanguage}
        placeholder="Preferred language"
        style={styles.input}
      />
      <TextInput
        value={preferredCurrency}
        onChangeText={setPreferredCurrency}
        placeholder="Preferred currency"
        style={styles.input}
      />
      <TextInput
        value={timezone}
        onChangeText={setTimezone}
        placeholder="Timezone"
        style={styles.input}
      />
      <View style={styles.row}>
        <Text style={styles.label}>Push notifications</Text>
        <Switch value={notifications} onValueChange={setNotifications} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Email updates</Text>
        <Switch value={emailUpdates} onValueChange={setEmailUpdates} />
      </View>
      <Pressable style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonText}>Save</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={signOut}>
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
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
  section: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  label: {
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 12,
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
    marginTop: 12,
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
  status: {
    marginTop: 8,
    color: "#6B7280",
  },
});
