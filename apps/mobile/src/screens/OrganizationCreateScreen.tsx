import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import type { BusinessType } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "OrganizationCreate">;

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "LLC", label: "LLC" },
  { value: "CORPORATION", label: "Corporation" },
  { value: "PARTNERSHIP", label: "Partnership" },
];

export function OrganizationCreateScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("INDIVIDUAL");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      setStatus("Organization name and email are required.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const org = await mobileClient.createOrganization({
        name: name.trim(),
        description: description.trim() || undefined,
        businessType,
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });
      navigation.replace("OrganizationSettings", { organizationId: org.id });
    } catch (err) {
      setStatus("Unable to create organization.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Organization</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Organization name"
        style={styles.input}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        style={styles.input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <Text style={styles.label}>Business type</Text>
      <View style={styles.typeRow}>
        {BUSINESS_TYPES.map((type) => (
          <Pressable
            key={type.value}
            style={[
              styles.typeChip,
              businessType === type.value && styles.typeChipActive,
            ]}
            onPress={() => setBusinessType(type.value)}
          >
            <Text
              style={[
                styles.typeText,
                businessType === type.value && styles.typeTextActive,
              ]}
            >
              {type.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Creating..." : "Create"}
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
  label: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  typeChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  typeText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  typeTextActive: {
    color: "#FFFFFF",
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
