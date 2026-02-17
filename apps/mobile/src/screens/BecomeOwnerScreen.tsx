import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "../api/authContext";
import { mobileClient } from "../api/client";

export function BecomeOwnerScreen() {
  const { user, setUser } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!agreed) {
      setStatus("Please accept the terms to continue.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const updated = await mobileClient.upgradeToOwner();
      setUser(updated);
      setStatus("You are now an owner.");
    } catch (err) {
      setStatus("Unable to upgrade account.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === "owner" || user?.role === "admin") {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>You are already an owner</Text>
        <Text style={styles.status}>Start listing your items right away.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Become an Owner</Text>
      <Text style={styles.subtitle}>
        Earn extra income by renting out items you own.
      </Text>
      <Pressable
        style={[styles.checkbox, agreed && styles.checkboxActive]}
        onPress={() => setAgreed((prev) => !prev)}
      >
        <Text style={[styles.checkboxText, agreed && styles.checkboxTextActive]}>
          I agree to the owner terms
        </Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={handleUpgrade} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Upgrading..." : "Become an owner"}
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
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 16,
  },
  checkbox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  checkboxActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  checkboxText: {
    color: "#111827",
    fontWeight: "600",
  },
  checkboxTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    marginTop: 8,
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
