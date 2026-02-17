import React, { useEffect, useState } from "react";
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from "react-native";
import { mobileClient, } from "../api/client";
import type { GeoSuggestion } from "@rental-portal/mobile-sdk";

type LocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: GeoSuggestion) => void;
};

export function LocationInput({ value, onChange, onSelect }: LocationInputProps) {
  const [results, setResults] = useState<GeoSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue || debouncedValue.trim().length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      try {
        let response = await mobileClient.geoAutocomplete(debouncedValue, {
          limit: 6,
          layer: "city",
          biasScale: 0.6,
        });
        if ((response.results?.length || 0) === 0) {
          response = await mobileClient.geoAutocomplete(debouncedValue, {
            limit: 6,
            biasScale: 0.6,
          });
        }
        setResults(response.results);
        setOpen(true);
      } catch (error) {
        setResults([]);
        setOpen(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue]);

  const renderItem = ({ item }: { item: GeoSuggestion }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => {
        onChange(item.shortLabel);
        setOpen(false);
        onSelect(item);
      }}
    >
      <Text style={styles.suggestionText}>{item.shortLabel}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Location"
        style={styles.input}
        returnKeyType="done"
      />
      {open && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          style={styles.dropdown}
        />
      )}
    </View>
  );
}

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    maxHeight: 180,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  suggestionText: {
    color: "#111827",
  },
});
