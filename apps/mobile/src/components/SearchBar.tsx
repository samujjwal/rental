import React, { useEffect, useState } from "react";
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from "react-native";
import { mobileClient } from "../api/client";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function SearchBar({ value, onChange, onSubmit }: SearchBarProps) {
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue || debouncedValue.trim().length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      try {
        const response = await mobileClient.search({
          query: debouncedValue,
          size: 5,
        });
        const titles = response.results.map((r) => r.title);
        setResults(titles);
        setOpen(true);
      } catch (error) {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue]);

  const renderItem = ({ item }: { item: string }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => {
        onChange(item);
        setOpen(false);
        onSubmit(item);
      }}
    >
      <Text style={styles.suggestionText}>{item}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search for items..."
        style={styles.input}
        returnKeyType="search"
        onSubmitEditing={() => onSubmit(value)}
      />
      {open && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item}-${index}`}
          renderItem={renderItem}
          style={styles.dropdown}
        />
      )}
      {loading && <Text style={styles.loading}>Searching...</Text>}
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
  loading: {
    marginTop: 6,
    color: "#6B7280",
  },
});
