import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { mobileClient } from "../api/client";
import type { NotificationPreferences } from "@rental-portal/mobile-sdk";

const DEFAULT_PREFS: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  inApp: true,
  bookingUpdates: true,
  paymentUpdates: true,
  reviewAlerts: true,
  messageAlerts: true,
  marketingEmails: false,
};

type PrefKey = keyof NotificationPreferences;

const CHANNEL_PREFS: Array<{ key: PrefKey; label: string; description: string }> = [
  { key: "email", label: "Email", description: "Updates to your inbox" },
  { key: "push", label: "Push", description: "Real-time alerts on your device" },
  { key: "sms", label: "SMS", description: "Text messages for urgent updates" },
  { key: "inApp", label: "In-app", description: "In-app activity notifications" },
];

const TYPE_PREFS: Array<{ key: PrefKey; label: string; description: string }> = [
  { key: "bookingUpdates", label: "Booking updates", description: "Requests and confirmations" },
  { key: "paymentUpdates", label: "Payment updates", description: "Charges and payouts" },
  { key: "messageAlerts", label: "Messages", description: "New messages" },
  { key: "reviewAlerts", label: "Reviews", description: "New ratings" },
  { key: "marketingEmails", label: "Marketing", description: "Promotions and updates" },
];

export function SettingsNotificationsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mobileClient.getNotificationPreferences();
        setPrefs(data);
      } catch (err) {
        setPrefs(DEFAULT_PREFS);
      }
    };
    load();
  }, []);

  const togglePref = (key: PrefKey) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("");
    try {
      await mobileClient.updateNotificationPreferences(prefs);
      setStatus("Saved.");
    } catch (err) {
      setStatus("Unable to save preferences.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Notification Preferences</Text>
      <View style={styles.channelBlock}>
        <Text style={styles.channelTitle}>Channels</Text>
        {CHANNEL_PREFS.map((pref) => (
          <View key={pref.key} style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>{pref.label}</Text>
              <Text style={styles.switchHelp}>{pref.description}</Text>
            </View>
            <Switch value={prefs[pref.key]} onValueChange={() => togglePref(pref.key)} />
          </View>
        ))}
      </View>
      <View style={styles.channelBlock}>
        <Text style={styles.channelTitle}>Activity Types</Text>
        {TYPE_PREFS.map((pref) => (
          <View key={pref.key} style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>{pref.label}</Text>
              <Text style={styles.switchHelp}>{pref.description}</Text>
            </View>
            <Switch value={prefs[pref.key]} onValueChange={() => togglePref(pref.key)} />
          </View>
        ))}
      </View>
      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Saving..." : "Save"}
        </Text>
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
    marginBottom: 12,
  },
  channelBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  channelTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  switchLabel: {
    color: "#111827",
  },
  switchHelp: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
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
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
});
