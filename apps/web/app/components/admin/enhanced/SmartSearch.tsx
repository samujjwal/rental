/**
 * Smart Search Component
 * Enhanced search with autocomplete, suggestions, and recent searches
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    TextField,
    Autocomplete,
    Box,
    Chip,
    InputAdornment,
    IconButton,
    Paper,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    History as HistoryIcon,
    TrendingUp as TrendingIcon,
} from '@mui/icons-material';

interface SmartSearchProps {
    placeholder?: string;
    value?: string;
    onChange: (value: string) => void;
    suggestions?: string[];
    recentSearches?: string[];
    onRecentSearchClick?: (search: string) => void;
    autoFocus?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'medium';
}

const RECENT_SEARCHES_KEY = 'admin_recent_searches';
const MAX_RECENT_SEARCHES = 5;

export const SmartSearch: React.FC<SmartSearchProps> = ({
    placeholder = 'Search...',
    value = '',
    onChange,
    suggestions = [],
    recentSearches: externalRecentSearches,
    onRecentSearchClick,
    autoFocus = false,
    fullWidth = true,
    size = 'small',
}) => {
    const [inputValue, setInputValue] = useState(value);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [showRecent, setShowRecent] = useState(false);

    // Load recent searches from localStorage
    useEffect(() => {
        if (!externalRecentSearches) {
            try {
                const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
                if (stored) {
                    setRecentSearches(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Failed to load recent searches:', error);
            }
        } else {
            setRecentSearches(externalRecentSearches);
        }
    }, [externalRecentSearches]);

    // Save search to recent searches
    const saveRecentSearch = useCallback((search: string) => {
        if (!search.trim()) return;

        setRecentSearches((prev) => {
            const filtered = prev.filter((s) => s !== search);
            const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);

            try {
                localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            } catch (error) {
                console.error('Failed to save recent search:', error);
            }

            return updated;
        });
    }, []);

    // Handle search change
    const handleSearchChange = useCallback((newValue: string) => {
        setInputValue(newValue);
        onChange(newValue);

        if (newValue.trim()) {
            saveRecentSearch(newValue);
        }
    }, [onChange, saveRecentSearch]);

    // Handle clear
    const handleClear = useCallback(() => {
        setInputValue('');
        onChange('');
    }, [onChange]);

    // Handle recent search click
    const handleRecentClick = useCallback((search: string) => {
        setInputValue(search);
        onChange(search);
        setShowRecent(false);

        if (onRecentSearchClick) {
            onRecentSearchClick(search);
        }
    }, [onChange, onRecentSearchClick]);

    // Combine suggestions with recent searches
    const options = useMemo(() => {
        const combined = [...new Set([...recentSearches, ...suggestions])];
        return combined;
    }, [recentSearches, suggestions]);

    return (
        <Autocomplete
            freeSolo
            fullWidth={fullWidth}
            options={options}
            value={inputValue}
            inputValue={inputValue}
            onInputChange={(_, newValue) => setInputValue(newValue)}
            onChange={(_, newValue) => {
                if (typeof newValue === 'string') {
                    handleSearchChange(newValue);
                }
            }}
            onFocus={() => setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    size={size}
                    autoFocus={autoFocus}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <>
                                {inputValue && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={handleClear}
                                            edge="end"
                                            aria-label="clear search"
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                )}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
            renderOption={(props, option) => {
                const isRecent = recentSearches.includes(option);
                const isSuggestion = suggestions.includes(option);

                return (
                    <li {...props}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            {isRecent && <HistoryIcon fontSize="small" color="action" />}
                            {isSuggestion && !isRecent && <TrendingIcon fontSize="small" color="action" />}
                            <Typography variant="body2">{option}</Typography>
                        </Box>
                    </li>
                );
            }}
            PaperComponent={({ children, ...paperProps }) => (
                <Paper {...paperProps} elevation={3}>
                    {showRecent && recentSearches.length > 0 && !inputValue && (
                        <Box sx={{ p: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                                Recent Searches
                            </Typography>
                            <Divider />
                        </Box>
                    )}
                    {children}
                </Paper>
            )}
        />
    );
};

export default SmartSearch;
