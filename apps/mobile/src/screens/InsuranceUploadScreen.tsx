import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Linking } from "react-native";
import { useAuth } from "../api/authContext";
import { authStore } from "../api/authStore";
import { API_BASE_URL, WEB_BASE_URL } from "../config";

export function InsuranceUploadScreen() {
  const { user } = useAuth();
  const [listingId, setListingId] = useState("");
  const [requirement, setRequirement] = useState<{
    required: boolean;
    reason?: string;
    type?: string;
    minimumCoverage?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadRequirement = async () => {
      if (!listingId.trim()) {
        setRequirement(null);
        return;
      }
      setLoading(true);
      setStatus("");
      try {
        const token = authStore.getToken();
        const response = await fetch(`${API_BASE_URL}/insurance/listings/${listingId}/requirement`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok) throw new Error("Unable to load requirement.");
        const data = await response.json();
        setRequirement(data);
        if (data?.type && !type) setType(data.type);
      } catch (err) {
        setRequirement(null);
        setStatus("Unable to load insurance requirements.");
      } finally {
        setLoading(false);
      }
    };

    loadRequirement();
  }, [listingId, type]);

  const handleSubmit = async () => {
    if (!user) {
      setStatus("Sign in to submit insurance.");
      return;
    }
    if (!listingId.trim()) {
      setStatus("Listing ID is required.");
      return;
    }

    setLoading(true);
    setStatus("");
    const url = `${WEB_BASE_URL}/insurance/upload?listingId=${encodeURIComponent(
      listingId.trim()
    )}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setStatus("Unable to open secure upload.");
        return;
      }
      await Linking.openURL(url);
      setStatus("Opened secure upload in browser.");
    } catch (err) {
      setStatus("Unable to open secure upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Insurance Policy</Text>
      {!user ? (
        <Text style={styles.notice}>Sign in to submit insurance details.</Text>
      ) : (
        <>
          <TextInput
            value={listingId}
            onChangeText={setListingId}
            placeholder="Listing ID"
            style={styles.input}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : requirement ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>
                {requirement.required ? "Insurance Required" : "Insurance Optional"}
              </Text>
              {requirement.reason ? <Text style={styles.noticeText}>{requirement.reason}</Text> : null}
              {requirement.minimumCoverage ? (
                <Text style={styles.noticeText}>Minimum: ${requirement.minimumCoverage}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? "Opening..." : "Open secure upload"}
            </Text>
          </Pressable>
          {status ? <Text style={styles.notice}>{status}</Text> : null}
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
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
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
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  notice: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  noticeTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  noticeText: {
    marginTop: 4,
    color: "#6B7280",
  },
});
