import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "SettingsIndex">;

export function SettingsIndexScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <Pressable style={styles.button} onPress={() => navigation.navigate("SettingsProfile")}>
        <Text style={styles.buttonText}>Profile Settings</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate("SettingsNotifications")}>
        <Text style={styles.buttonText}>Notifications</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate("Settings")}>
        <Text style={styles.buttonText}>Preferences</Text>
      </Pressable>
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
  button: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  buttonText: {
    color: "#111827",
    fontWeight: "600",
  },
});
