import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import type { TabParamList } from '../navigation/TabNavigator';
import { mobileClient } from '../api/client';
import { useAuth } from '../api/authContext';
import { ListingCard } from '../components/ListingCard';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { showApiError, showSuccess } from '../components/Toast';
import { FormButton } from '../components/FormInput';
import type { SearchResult, Category } from '~/types';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { getCurrencySymbol } from '../utils/currency';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'SearchTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

const PAGE_SIZE = 20;

const CONDITION_OPTIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const;

export function SearchScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { query: initialQuery, location, lat, lon, radius } = route.params || {};

  // Search state
  const [searchText, setSearchText] = useState(initialQuery || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('');
  const [instantBooking, setInstantBooking] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const isFirstLoad = useRef(true);

  // Sync search text when navigation params change
  useEffect(() => {
    const newQuery = route.params?.query;
    if (newQuery !== undefined) {
      setSearchText(newQuery);
    }
  }, [route.params?.query]);

  // Fetch categories for filter
  useEffect(() => {
    mobileClient.categories().then(setCategories).catch(() => {});
  }, []);

  // Fetch favorites
  useEffect(() => {
    if (!user) return;
    mobileClient
      .getFavorites()
      .then((favs) => setFavoriteIds(new Set(favs.map((l) => l.id))))
      .catch(() => {});
  }, [user]);

  const doSearch = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (pageNum === 1) {
        isRefresh ? setRefreshing(true) : setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await mobileClient.search({
          query: searchText || undefined,
          lat,
          lon,
          radius,
          categoryId: categoryId || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          condition: condition || undefined,
          bookingMode: instantBooking ? 'INSTANT_BOOK' : undefined,
          page: pageNum,
          size: PAGE_SIZE,
        });

        const newResults = response.results || [];
        if (pageNum === 1) {
          setResults(newResults);
        } else {
          setResults((prev) => [...prev, ...newResults]);
        }
        setTotal(response.total || 0);
        setPage(pageNum);
      } catch (err) {
        if (pageNum === 1) setResults([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [searchText, lat, lon, radius, categoryId, minPrice, maxPrice, condition, instantBooking],
  );

  // Initial search
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      doSearch(1);
    }
  }, [doSearch]);

  const onRefresh = useCallback(() => doSearch(1, true), [doSearch]);

  const onEndReached = useCallback(() => {
    if (loadingMore || loading) return;
    if (results.length >= total) return;
    doSearch(page + 1);
  }, [doSearch, page, total, results.length, loadingMore, loading]);

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    doSearch(1);
  }, [doSearch]);

  const applyFilters = useCallback(() => {
    setShowFilters(false);
    doSearch(1);
  }, [doSearch]);

  const clearFilters = useCallback(() => {
    setMinPrice('');
    setMaxPrice('');
    setCategoryId('');
    setCondition('');
    setInstantBooking(false);
  }, []);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!user) return;
      const isFav = favoriteIds.has(listingId);
      try {
        if (isFav) {
          await mobileClient.removeFavorite(listingId);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
          showSuccess('Removed from favorites');
        } else {
          await mobileClient.addFavorite(listingId);
          setFavoriteIds((prev) => new Set(prev).add(listingId));
          showSuccess('Added to favorites');
        }
      } catch (err) {
        showApiError(err);
      }
    },
    [user, favoriteIds],
  );

  const hasActiveFilters = !!(minPrice || maxPrice || categoryId || condition || instantBooking);
  const activeFilterCount = [!!minPrice, !!maxPrice, !!categoryId, !!condition, instantBooking].filter(Boolean).length;

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <ListingCard
        listing={item}
        onPress={() => navigation.navigate('Listing', { listingId: item.id })}
        isFavorite={favoriteIds.has(item.id)}
        onToggleFavorite={user ? () => toggleFavorite(item.id) : undefined}
      />
    ),
    [navigation, favoriteIds, user, toggleFavorite],
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search rentals..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>{'\uD83D\uDD0D'}</Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterButtonText}>
            {'\u2699\uFE0F'}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Location info */}
      {location && (
        <Text style={styles.locationText}>Near {location}</Text>
      )}

      {/* Results count */}
      {!loading && (
        <Text style={styles.resultCount}>
          {total} result{total !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <CardListSkeleton count={4} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search or filters.
              </Text>
            </View>
          }
          contentContainerStyle={results.length === 0 ? styles.emptyList : styles.listContent}
        />
      )}

      {/* Filter modal */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <Pressable onPress={() => setShowFilters(false)}>
                  <Text style={styles.closeButton}>{'\u2715'}</Text>
                </Pressable>
              </View>

              {/* Price range */}
              <Text style={styles.filterLabel}>{`Price Range (${getCurrencySymbol()})`}</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  value={minPrice}
                  onChangeText={setMinPrice}
                  placeholder="Min"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.priceSeparator}>to</Text>
                <TextInput
                  style={styles.priceInput}
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="Max"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Category */}
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !categoryId && styles.chipActive]}
                  onPress={() => setCategoryId('')}
                >
                  <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>All</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Condition */}
              <Text style={styles.filterLabel}>Condition</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !condition && styles.chipActive]}
                  onPress={() => setCondition('')}
                >
                  <Text style={[styles.chipText, !condition && styles.chipTextActive]}>Any</Text>
                </Pressable>
                {CONDITION_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, condition === c && styles.chipActive]}
                    onPress={() => setCondition(c)}
                  >
                    <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
                      {c.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Instant booking toggle */}
              <Pressable
                style={styles.toggleRow}
                onPress={() => setInstantBooking(!instantBooking)}
              >
                <Text style={styles.filterLabel}>Instant Booking Only</Text>
                <View style={[styles.toggle, instantBooking && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, instantBooking && styles.toggleThumbOn]} />
                </View>
              </Pressable>

              {/* Action buttons */}
              <View style={styles.filterActions}>
                <FormButton title="Clear All" variant="outline" onPress={clearFilters} />
                <View style={{ width: spacing.sm }} />
                <FormButton title="Apply Filters" onPress={applyFilters} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    padding: spacing.sm,
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  filterButtonText: {
    fontSize: 18,
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  resultCount: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.xs,
  },
  skeletonContainer: {
    padding: spacing.md,
  },
  footerLoader: {
    padding: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
  },
  closeButton: {
    fontSize: 20,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  filterLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  priceSeparator: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  filterActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
