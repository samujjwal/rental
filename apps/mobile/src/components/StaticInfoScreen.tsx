import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

type StaticInfoScreenProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  onPressCta?: () => void;
};

export function StaticInfoScreen({
  title,
  description,
  ctaLabel,
  onPressCta,
}: StaticInfoScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {ctaLabel && onPressCta ? (
        <Pressable style={styles.ctaButton} onPress={onPressCta}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
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
