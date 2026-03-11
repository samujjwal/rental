import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import type { OrganizationMember, OrganizationRole } from '~/types';

type Props = NativeStackScreenProps<RootStackParamList, "OrganizationMembers">;

const ROLES: OrganizationRole[] = ["OWNER", "ADMIN", "MEMBER"];
const EDITABLE_ROLES: OrganizationRole[] = ["ADMIN", "MEMBER"];

export function OrganizationMembersScreen({ route }: Props) {
  const { organizationId } = route.params;
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [status, setStatus] = useState("");

  const loadMembers = async () => {
    try {
      const response = await mobileClient.getOrganizationMembers(organizationId);
      setMembers(response.members || []);
    } catch (err) {
      setStatus("Unable to load members.");
    }
  };

  useEffect(() => {
    loadMembers();
  }, [organizationId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setStatus("Enter an email to invite.");
      return;
    }
    try {
      await mobileClient.inviteOrganizationMember(organizationId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
      setStatus("Invitation sent.");
      loadMembers();
    } catch (err) {
      setStatus("Unable to invite member.");
    }
  };

  const handleRoleChange = async (memberUserId: string, role: OrganizationRole) => {
    try {
      await mobileClient.updateOrganizationMemberRole(organizationId, memberUserId, { role });
      loadMembers();
    } catch (err) {
      setStatus("Unable to update role.");
    }
  };

  const handleRemove = async (memberUserId: string) => {
    try {
      await mobileClient.removeOrganizationMember(organizationId, memberUserId);
      setMembers((prev) => prev.filter((member) => member.userId !== memberUserId));
    } catch (err) {
      setStatus("Unable to remove member.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Team Members</Text>
      <View style={styles.inviteRow}>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Invite email"
          keyboardType="email-address"
          style={styles.input}
        />
        <Pressable style={styles.inviteButton} onPress={handleInvite}>
          <Text style={styles.inviteButtonText}>Invite</Text>
        </Pressable>
      </View>
      <View style={styles.roleRow}>
        {EDITABLE_ROLES.map((role) => (
          <Pressable
            key={role}
            style={[
              styles.roleChip,
              inviteRole === role && styles.roleChipActive,
            ]}
            onPress={() => setInviteRole(role)}
          >
            <Text
              style={[
                styles.roleText,
                inviteRole === role && styles.roleTextActive,
              ]}
            >
              {role}
            </Text>
          </Pressable>
        ))}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.user.firstName} {item.user.lastName || ""}
            </Text>
            <Text style={styles.subtitle}>{item.user.email}</Text>
            <View style={styles.memberActions}>
              {EDITABLE_ROLES.map((role) => (
                <Pressable
                  key={role}
                  style={[
                    styles.roleChip,
                    item.role === role && styles.roleChipActive,
                  ]}
                  onPress={() => handleRoleChange(item.userId, role)}
                >
                  <Text
                    style={[
                      styles.roleText,
                      item.role === role && styles.roleTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
              {item.role !== "OWNER" ? (
                <Pressable style={styles.removeButton} onPress={() => handleRemove(item.userId)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No members yet.</Text>}
      />
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
  inviteRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  inviteButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  roleChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  roleText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  roleTextActive: {
    color: "#FFFFFF",
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  title: {
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 4,
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
  },
  removeButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  removeButtonText: {
    color: "#991B1B",
    fontWeight: "600",
    fontSize: 12,
  },
});
