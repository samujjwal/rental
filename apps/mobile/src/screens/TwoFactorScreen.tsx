/**
 * TwoFactorScreen
 *
 * Rendered after a successful login attempt when the backend responds with
 * `requiresMfa: true`. The user enters their 6-digit TOTP/OTP code here.
 * On success the normal post-login flow continues (token stored, navigate to Main).
 */

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { saveTokens } from "../api/authStore";

type Props = NativeStackScreenProps<RootStackParamList, "TwoFactor">;

export function TwoFactorScreen({ navigation, route }: Props) {
  const { email, password } = route.params;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Please enter your 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await mobileClient.login({ email, password, mfaCode: code });
      await saveTokens(result.accessToken, result.refreshToken);
      navigation.replace("Main");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.heading}>Two-Factor Verification</Text>
        <Text style={styles.subheading}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          ref={inputRef}
          style={styles.codeInput}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor="#9CA3AF"
          autoFocus
          accessible
          accessibilityLabel="Two-factor authentication code"
        />

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Verify code"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.backLink}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
        >
          <Text style={styles.backLinkText}>Back to Login</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 32,
  },
  codeInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    color: "#111827",
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  backLink: {
    alignItems: "center",
  },
  backLinkText: {
    color: "#6B7280",
    fontSize: 14,
  },
});
