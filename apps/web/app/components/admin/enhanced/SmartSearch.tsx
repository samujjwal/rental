/**
 * Smart Search Component
 * Enhanced search with autocomplete, suggestions, and recent searches
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Search, X, History, TrendingUp } from "lucide-react";

interface SmartSearchProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  onRecentSearchClick?: (search: string) => void;
  autoFocus?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
}

const RECENT_SEARCHES_KEY = "admin_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export const SmartSearch: React.FC<SmartSearchProps> = ({
  placeholder = "Search...",
  value = "",
  onChange,
  suggestions = [],
  recentSearches: externalRecentSearches,
  onRecentSearchClick,
  autoFocus = false,
  fullWidth = true,
  size = "small",
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!externalRecentSearches) {
      try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load recent searches:", error);
      }
    } else {
      setRecentSearches(externalRecentSearches);
    }
  }, [externalRecentSearches]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const saveRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== search);
      const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save recent search:", error);
      }
      return updated;
    });
  }, []);

  const handleSearchChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      onChange(newValue);
      if (newValue.trim()) saveRecentSearch(newValue);
    },
    [onChange, saveRecentSearch]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    onChange("");
  }, [onChange]);

  const options = useMemo(() => {
    const combined = [...new Set([...recentSearches, ...suggestions])];
    if (inputValue) {
      return combined.filter((o) =>
        o.toLowerCase().includes(inputValue.toLowerCase())
      );
    }
    return combined;
  }, [recentSearches, suggestions, inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const inputPadding = size === "small" ? "py-1.5 px-3" : "py-2.5 px-4";

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? "w-full" : "w-64"}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          name="search"
          className={`${inputPadding} pl-9 pr-9 w-full rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          placeholder={placeholder}
          value={inputValue}
          aria-label="Search"
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputValue.trim()) {
              saveRecentSearch(inputValue);
              setIsOpen(false);
            }
            if (e.key === "Escape") setIsOpen(false);
          }}
          autoFocus={autoFocus}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-muted"
            aria-label="clear search"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
          {!inputValue && recentSearches.length > 0 && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b">
              Recent Searches
            </div>
          )}
          {options.map((option) => {
            const isRecent = recentSearches.includes(option);
            return (
              <button
                key={option}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                onClick={() => {
                  handleSearchChange(option);
                  if (isRecent) onRecentSearchClick?.(option);
                  setIsOpen(false);
                }}
              >
                {isRecent ? (
                  <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{option}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmartSearch;
