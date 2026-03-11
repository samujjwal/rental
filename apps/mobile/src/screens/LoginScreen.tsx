import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../api/authContext";


type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      navigation.replace("Main");
    } catch (err) {
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
