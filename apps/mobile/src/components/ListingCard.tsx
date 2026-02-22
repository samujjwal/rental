import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import type { SearchResult } from '@rental-portal/mobile-sdk';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type ListingCardProps = {
  listing: SearchResult;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export function ListingCard({
  listing,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}: ListingCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, $${listing.basePrice} per day${listing.averageRating > 0 ? `, rated ${listing.averageRating.toFixed(1)} stars` : ''}`}
      accessibilityHint="Opens listing details"
    >
      <View style={styles.imageContainer}>
        {listing.photos?.[0] ? (
          <Image source={{ uri: listing.photos[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>
              {(listing.title || 'L').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {onToggleFavorite && (
          <Pressable
            style={styles.favoriteButton}
            onPress={() => onToggleFavorite()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityState={{ selected: isFavorite }}
          >
            <Text style={styles.favoriteIcon}>{isFavorite ? '\u2764\uFE0F' : '\uD83E\uDD0D'}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {listing.city}{listing.state ? `, ${listing.state}` : ''}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.price}>${listing.basePrice}/day</Text>
          {listing.averageRating > 0 && (
            <Text style={styles.rating}>
              {'\u2B50'} {listing.averageRating.toFixed(1)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 110,
    height: 96,
    backgroundColor: colors.borderLight,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.h2,
    color: colors.textMuted,
  },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  price: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  rating: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
});
