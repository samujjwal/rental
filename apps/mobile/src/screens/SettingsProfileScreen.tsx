import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { mobileClient } from "../api/client";

export function SettingsProfileScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await mobileClient.getProfile();
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setPhoneNumber(profile.phoneNumber || "");
        setCity(profile.city || "");
        setState(profile.state || "");
        setCountry(profile.country || "");
      } catch (err) {
        setStatus("Unable to load profile.");
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setStatus("");
    try {
      await mobileClient.updateProfile({
        firstName,
        lastName,
        phoneNumber,
        city,
        state,
        country,
      });
      setStatus("Saved.");
    } catch (err) {
      setStatus("Unable to save changes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Profile Settings</Text>
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        style={styles.input}
      />
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        style={styles.input}
      />
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="City"
        style={styles.input}
      />
      <TextInput
        value={state}
        onChangeText={setState}
        placeholder="State"
        style={styles.input}
      />
      <TextInput
        value={country}
        onChangeText={setCountry}
        placeholder="Country"
        style={styles.input}
      />
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
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
});
