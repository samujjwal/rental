import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import type { SearchResult } from "@rental-portal/mobile-sdk";


type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export function SearchScreen({ navigation, route }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { query, location, lat, lon, radius } = route.params || {};

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await mobileClient.search({
          query,
          lat,
          lon,
          radius,
          page: 1,
          size: 20,
        });
        setResults(response.results);
      } catch (error) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, lat, lon, radius]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Results</Text>
      {location && <Text style={styles.location}>Near {location}</Text>}
      {loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => navigation.navigate("Listing", { listingId: item.id })}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No results found.</Text>}
        />
      )}
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
    marginBottom: 8,
  },
  location: {
    color: "#6B7280",
    marginBottom: 12,
  },
  empty: {
    color: "#6B7280",
    textAlign: "center",
    marginTop: 40,
  },
});
