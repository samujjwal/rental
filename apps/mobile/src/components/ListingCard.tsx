import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import type { SearchResult } from "@rental-portal/mobile-sdk";

type ListingCardProps = {
  listing: SearchResult;
  onPress: () => void;
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {listing.photos?.[0] ? (
        <Image source={{ uri: listing.photos[0] }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.subtitle}>
          {listing.city}, {listing.state}
        </Text>
        <Text style={styles.price}>${listing.basePrice}/day</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: 110,
    height: 90,
    backgroundColor: "#F3F4F6",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    padding: 12,
  },
  title: {
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
  },
  price: {
    marginTop: 8,
    fontWeight: "700",
    color: "#111827",
  },
});
