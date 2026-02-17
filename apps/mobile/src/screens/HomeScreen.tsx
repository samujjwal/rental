import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SearchBar } from "../components/SearchBar";
import { LocationInput } from "../components/LocationInput";
import type { GeoSuggestion } from "@rental-portal/mobile-sdk";
import type { RootStackParamList } from "../../App";


type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const handleLocationSelect = (suggestion: GeoSuggestion) => {
    setLocation(suggestion.shortLabel);
    setCoords({
      lat: suggestion.coordinates.lat,
      lon: suggestion.coordinates.lon,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Find your next rental</Text>
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={(value) =>
          navigation.navigate("Search", {
            query: value,
            location,
            lat: coords?.lat,
            lon: coords?.lon,
            radius: 25,
          })
        }
      />
      <View style={styles.section}>
        <LocationInput
          value={location}
          onChange={(value) => {
            setLocation(value);
            if (!value) setCoords(null);
          }}
          onSelect={handleLocationSelect}
        />
        <Pressable
          style={styles.locationButton}
          onPress={() => {
            navigation.navigate("Search", {
              query,
              location,
              lat: coords?.lat,
              lon: coords?.lon,
              radius: 25,
            });
          }}
        >
          <Text style={styles.locationButtonText}>Use my location</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() =>
          navigation.navigate("Search", {
            query,
            location,
            lat: coords?.lat,
            lon: coords?.lon,
            radius: 25,
          })
        }
      >
        <Text style={styles.primaryButtonText}>Search</Text>
      </Pressable>

      <View style={styles.quickLinks}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Bookings")}
        >
          <Text style={styles.secondaryButtonText}>My Bookings</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Messages")}
        >
          <Text style={styles.secondaryButtonText}>Messages</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("CreateListing")}
        >
          <Text style={styles.secondaryButtonText}>List Item</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("OwnerDashboard")}
        >
          <Text style={styles.secondaryButtonText}>Owner Stats</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Reviews")}
        >
          <Text style={styles.secondaryButtonText}>Reviews</Text>
        </Pressable>
      </View>
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
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  section: {
    marginTop: 16,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  locationButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  locationButtonText: {
    color: "#2563EB",
    fontWeight: "600",
  },
  quickLinks: {
    marginTop: 24,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
});
