import React, { useState, useEffect } from "react";
import { Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";
import { useBiometricAuth, offerBiometricEnrollment } from "../hooks/useBiometricAuth";
import { authStore } from "../api/authStore";
import { mobileClient } from "../api/client";


type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { isAvailable, isEnabled, biometricLabel, authenticate, enable } = useBiometricAuth();

  // Auto-prompt biometric on mount if it's enabled and a stored token exists
  useEffect(() => {
    if (!isAvailable || !isEnabled) return;
    let cancelled = false;

    async function tryBiometricUnlock() {
      const token = await authStore.getToken();
      if (!token || cancelled) return;

      const success = await authenticate();
      if (success && !cancelled) {
        try {
          // Validate the stored token is still accepted by the server
          await mobileClient.getProfile();
          if (!cancelled) navigation.replace("Main");
        } catch {
          // Token is expired or revoked; let the user log in with password
        }
      }
    }

    tryBiometricUnlock();
    return () => { cancelled = true; };
  // Only run once after biometric state is initialized
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, isAvailable]);

  const handleLogin = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn({ email, password });
      // Offer biometric enrollment after first successful password login
      await offerBiometricEnrollment(biometricLabel, enable);
      navigation.replace("Main");
    } catch (err) {
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const success = await authenticate();
      if (success) {
        // Validate the stored token against the server before navigating
        await mobileClient.getProfile();
        navigation.replace("Main");
      } else {
        setError(`${biometricLabel} authentication failed. Use your password instead.`);
      }
    } catch {
      setError("Your session has expired. Please sign in with your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>
      {isAvailable && isEnabled ? (
        <Pressable
          style={[styles.biometricButton, loading && styles.primaryButtonDisabled]}
          onPress={handleBiometricLogin}
          disabled={loading}
          accessibilityLabel={`Sign in with ${biometricLabel}`}
          accessibilityRole="button"
        >
          <Text style={styles.biometricButtonText}>Sign in with {biometricLabel}</Text>
        </Pressable>
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        testID="email-input"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        testID="password-input"
        style={styles.input}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleLogin} disabled={loading} accessibilityLabel={loading ? "Signing in" : "Sign In"} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>{loading ? "Signing in..." : "Sign In"}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.linkButton} accessibilityLabel="Forgot password" accessibilityRole="link">
        <Text style={styles.linkText}>Forgot password?</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Signup")} style={styles.linkButton} accessibilityLabel="Create an account" accessibilityRole="link">
        <Text style={styles.linkText}>Create an account</Text>
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
    marginBottom: 16,
  },
  biometricButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  biometricButtonText: {
    color: "#2563EB",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  error: {
    color: "#DC2626",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    color: "#2563EB",
    fontWeight: "600",
  },
});
