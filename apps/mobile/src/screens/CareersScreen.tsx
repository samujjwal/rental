import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Careers">;

export function CareersScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Careers</Text>
      <Text style={styles.description}>
        Join our team and help build a more connected rental economy.
      </Text>
      <Pressable style={styles.ctaButton} onPress={() => navigation.navigate("Contact")}>
        <Text style={styles.ctaText}>Contact us</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
