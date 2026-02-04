import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '~/lib/utils';
import { formatCurrency } from '~/lib/utils';
import { useDebounce } from '~/hooks/use-debounce';
import { prefersReducedMotion, Keys } from '~/lib/accessibility';
import { listingsApi } from '~/lib/api/listings';
import { OptimizedImage } from '~/components/ui/OptimizedImage';

export interface InstantSearchProps {
    placeholder?: string;
    minChars?: number;
    maxResults?: number;
    debounceMs?: number;
    className?: string;
    onSearch?: (query: string) => void;
    autoFocus?: boolean;
}

interface SearchResult {
    id: string;
    title: string;
    images?: string[];
    pricePerDay: number;
    location?: {
        city?: string;
        state?: string;
    };
}

/**
 * InstantSearch - Search input with instant results dropdown
 * 
 * Features:
 * - Debounced search as user types
 * - Animated dropdown with results
 * - Keyboard navigation (↑↓ Enter Escape)
 * - Loading state
 * - Click outside to close
 * - Accessible with ARIA
 */
export function InstantSearch({
    placeholder = 'Search for items...',
    minChars = 2,
    maxResults = 5,
    debounceMs = 300,
    className,
    onSearch,
    autoFocus = false,
}: InstantSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const shouldReduceMotion = prefersReducedMotion();

    const debouncedQuery = useDebounce(query, debounceMs);

    // Fetch results when debounced query changes
    useEffect(() => {
        const fetchResults = async () => {
            if (debouncedQuery.length < minChars) {
                setResults([]);
                setIsOpen(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const response = await listingsApi.searchListings({
                    query: debouncedQuery,
                    limit: maxResults,
                });
                setResults(response.listings || []);
                setIsOpen(true);
                setSelectedIndex(-1);
            } catch (err) {
                console.error('Search error:', err);
                setError('Failed to search. Please try again.');
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, [debouncedQuery, minChars, maxResults]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (!isOpen || results.length === 0) {
                if (event.key === Keys.ENTER && query.length >= minChars) {
                    event.preventDefault();
                    onSearch?.(query);
                    navigate(`/search?query=${encodeURIComponent(query)}`);
                }
                return;
            }

            switch (event.key) {
                case Keys.ARROW_DOWN:
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
                    break;
                case Keys.ARROW_UP:
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
                    break;
                case Keys.ENTER:
                    event.preventDefault();
                    if (selectedIndex >= 0 && results[selectedIndex]) {
                        navigate(`/listings/${results[selectedIndex].id}`);
                        setIsOpen(false);
                    } else {
                        onSearch?.(query);
                        navigate(`/search?query=${encodeURIComponent(query)}`);
                    }
                    break;
                case Keys.ESCAPE:
                    event.preventDefault();
                    setIsOpen(false);
                    inputRef.current?.blur();
                    break;
            }
        },
        [isOpen, results, selectedIndex, query, minChars, navigate, onSearch]
    );

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.length >= minChars) {
            onSearch?.(query);
            navigate(`/search?query=${encodeURIComponent(query)}`);
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <form onSubmit={handleSubmit}>
                <div className="relative">
                    {/* Search Icon */}
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
                        aria-hidden="true"
                    />

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query.length >= minChars && results.length > 0 && setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        className={cn(
                            'w-full pl-10 pr-20 py-2.5 border border-input rounded-lg bg-background',
                            'text-foreground placeholder:text-muted-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
                            'transition-all duration-200'
                        )}
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-haspopup="listbox"
                        aria-controls="search-results"
                        aria-autocomplete="list"
                    />

                    {/* Right side icons/buttons */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {isLoading && (
                            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                        {query && !isLoading && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="submit"
                            className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            Search
                        </button>
                    </div>
                </div>
            </form>

            {/* Results Dropdown */}
            <AnimatePresence>
                {isOpen && (results.length > 0 || error) && (
                    <motion.div
                        id="search-results"
                        role="listbox"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border z-50 overflow-hidden"
                    >
                        {error ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                {error}
                            </div>
                        ) : (
                            <>
                                {results.map((result, index) => (
                                    <Link
                                        key={result.id}
                                        to={`/listings/${result.id}`}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            'flex items-center gap-3 p-3 transition-colors',
                                            'hover:bg-accent focus:bg-accent focus:outline-none',
                                            selectedIndex === index && 'bg-accent'
                                        )}
                                        role="option"
                                        aria-selected={selectedIndex === index}
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                                            {result.images?.[0] ? (
                                                <OptimizedImage
                                                    src={result.images[0]}
                                                    alt={result.title}
                                                    aspectRatio="square"
                                                    className="w-full h-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                                    No img
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground truncate">
                                                {result.title}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatCurrency(result.pricePerDay)}/day
                                                {result.location?.city && ` • ${result.location.city}`}
                                            </p>
                                        </div>

                                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </Link>
                                ))}

                                {/* View all results link */}
                                <Link
                                    to={`/search?query=${encodeURIComponent(query)}`}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-center gap-2 p-3 border-t text-sm font-medium text-primary hover:bg-accent transition-colors"
                                >
                                    View all results
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default InstantSearch;
