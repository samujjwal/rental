import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation }: Props) {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim() || !password.trim()) {
      setStatus("Token and password are required.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      await mobileClient.resetPassword(token.trim(), password);
      setStatus("Password reset successfully.");
      navigation.replace("Login");
    } catch (err) {
      setStatus("Unable to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Reset password</Text>
      <Text style={styles.description}>
        Paste the reset token from your email and choose a new password.
      </Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="Reset token"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        secureTextEntry
        style={styles.input}
      />
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm password"
        secureTextEntry
        style={styles.input}
      />
      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Updating..." : "Reset password"}
        </Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
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
});
