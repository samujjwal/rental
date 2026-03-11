import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setStatus("Please enter your email.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      await mobileClient.requestPasswordReset(email.trim());
      setStatus("Check your email for a password reset link.");
    } catch (err) {
      setStatus("Unable to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Forgot password</Text>
      <Text style={styles.description}>
        Enter your email address and we will send you a reset link.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Sending..." : "Send reset link"}
        </Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable onPress={() => navigation.navigate("Login")} style={styles.linkButton}>
        <Text style={styles.linkText}>Back to login</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  description: {
    color: "#4B5563",
    marginBottom: 16,
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
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    color: "#2563EB",
    fontWeight: "600",
  },
});
