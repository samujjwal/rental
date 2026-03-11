import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Switch } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import type { Organization } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "OrganizationSettings">;

export function OrganizationSettingsScreen({ route, navigation }: Props) {
  const { organizationId } = route.params;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [autoApproveMembers, setAutoApproveMembers] = useState(false);
  const [requireInsurance, setRequireInsurance] = useState(false);
  const [allowPublicProfile, setAllowPublicProfile] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mobileClient.getOrganization(organizationId);
        setOrganization(data);
        setName(data.name || "");
        setDescription(data.description || "");
        setWebsite(data.website || "");
        setEmail(data.email || "");
        setPhoneNumber(data.phone || "");
        setAutoApproveMembers(Boolean(data.settings?.autoApproveMembers));
        setRequireInsurance(Boolean(data.settings?.requireInsurance));
        setAllowPublicProfile(Boolean(data.settings?.allowPublicProfile));
      } catch (err) {
        setStatus("Unable to load organization.");
      }
    };
    load();
  }, [organizationId]);

  const handleSave = async () => {
    setLoading(true);
    setStatus("");
    try {
      await mobileClient.updateOrganization(organizationId, {
        name,
        description: description || undefined,
        website: website || undefined,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        settings: {
          autoApproveMembers,
          requireInsurance,
          allowPublicProfile,
        },
      });
      setStatus("Saved.");
    } catch (err) {
      setStatus("Unable to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await mobileClient.deactivateOrganization(organizationId);
      navigation.navigate("Organizations");
    } catch (err) {
      setStatus("Unable to deactivate organization.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Organization Settings</Text>
      {organization ? <Text style={styles.subtitle}>{organization.name}</Text> : null}
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
        value={website}
        onChangeText={setWebsite}
        placeholder="Website"
        style={styles.input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        style={styles.input}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Auto-approve members</Text>
        <Switch value={autoApproveMembers} onValueChange={setAutoApproveMembers} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Require insurance</Text>
        <Switch value={requireInsurance} onValueChange={setRequireInsurance} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Public profile</Text>
        <Switch value={allowPublicProfile} onValueChange={setAllowPublicProfile} />
      </View>
      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Saving..." : "Save"}
        </Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={handleDeactivate}>
        <Text style={styles.secondaryButtonText}>Deactivate</Text>
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
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B7280",
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  switchLabel: {
    color: "#111827",
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
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
});
