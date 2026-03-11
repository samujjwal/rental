import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { SearchBar } from "../components/SearchBar";
import { LocationInput } from "../components/LocationInput";
import { useAuth } from "../api/authContext";
import type { GeoSuggestion } from '~/types';
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/TabNavigator";


type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "HomeTab">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Find your next rental</Text>
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={(value) =>
          navigation.navigate("SearchTab", {
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
          accessibilityLabel="Search this area"
          accessibilityHint="Searches for listings in the selected location"
          onPress={() => {
            navigation.navigate("SearchTab", {
              query,
              location,
              lat: coords?.lat,
              lon: coords?.lon,
              radius: 25,
            });
          }}
        >
          <Text style={styles.locationButtonText}>Search this area</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.primaryButton}
        accessibilityLabel="Search"
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate("SearchTab", {
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
          accessibilityLabel="My Bookings"
          accessibilityRole="button"
          onPress={() => navigation.navigate("BookingsTab")}
        >
          <Text style={styles.secondaryButtonText}>My Bookings</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          accessibilityLabel="Messages"
          accessibilityRole="button"
          onPress={() => navigation.navigate("MessagesTab")}
        >
          <Text style={styles.secondaryButtonText}>Messages</Text>
        </Pressable>
        {user && (
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="My Favorites"
            accessibilityRole="button"
            onPress={() => navigation.navigate("Favorites")}
          >
            <Text style={styles.secondaryButtonText}>Favorites</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.secondaryButton}
          accessibilityLabel="List Item"
          accessibilityHint="Create a new listing"
          accessibilityRole="button"
          onPress={() => {
            if (!user) { navigation.navigate("Login"); return; }
            navigation.navigate("CreateListing");
          }}
        >
          <Text style={styles.secondaryButtonText}>List Item</Text>
        </Pressable>
        {user?.role === "owner" && (
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="Owner Stats"
            accessibilityHint="View your owner dashboard"
            accessibilityRole="button"
            onPress={() => navigation.navigate("OwnerDashboard")}
          >
            <Text style={styles.secondaryButtonText}>Owner Stats</Text>
          </Pressable>
        )}
        {user && user.role !== "owner" && (
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="Become an Owner"
            accessibilityRole="button"
            onPress={() => navigation.navigate("BecomeOwner")}
          >
            <Text style={styles.secondaryButtonText}>Become Owner</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.secondaryButton}
          accessibilityLabel="Reviews"
          accessibilityRole="button"
          onPress={() => {
            if (!user) { navigation.navigate("Login"); return; }
            navigation.navigate("Reviews");
          }}
        >
          <Text style={styles.secondaryButtonText}>Reviews</Text>
        </Pressable>
      </View>
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
    flexWrap: "wrap",
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
