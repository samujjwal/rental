import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import type { ListingDetail, ReviewResponse } from '~/types';
import { formatCurrency } from '../utils/currency';
import { pricingModeLabel } from '../utils/pricing';
import { formatDate } from '../utils/date';


type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

export function ListingScreen({ route, navigation }: Props) {
  const { listingId } = route.params;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchListing = async () => {
        setLoading(true);
        try {
          const response = await mobileClient.getListing(listingId);
          setListing(response);
        } catch (error) {
          setListing(null);
        } finally {
          setLoading(false);
        }
      };

      fetchListing();
    }, [listingId])
  );

  const fetchReviews = async (page: number) => {
    setLoadingReviews(true);
    try {
      const response = await mobileClient.getListingReviews(listingId, page, 5);
      const nextReviews = response.reviews || [];
      setReviews(page === 1 ? nextReviews : [...reviews, ...nextReviews]);
      setReviewsTotal(response.total || nextReviews.length);
      setReviewsPage(page);
    } catch (error) {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchReviews(1);
  }, [listingId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#111827" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loading}>
        <Text style={styles.subtitle}>Unable to load listing.</Text>
      </View>
    );
  }

  const imageUrl = listing.images?.[0] || listing.photos?.[0];
  const price = listing.pricePerDay ?? listing.basePrice;

  return (
    <ScrollView style={styles.container}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.hero} />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}
      <View style={styles.content}>
        <Text style={styles.heading}>{listing.title}</Text>
        {price != null && (
          <Text style={styles.price}>{formatCurrency(price)}{pricingModeLabel(listing.pricingMode)}</Text>
        )}
        {listing.location?.city && (
          <Text style={styles.subtitle}>
            {listing.location.city}
            {listing.location.state ? `, ${listing.location.state}` : ""}
          </Text>
        )}
        {listing.averageRating != null && (
          <Text style={styles.subtitle}>
            Rating: {listing.averageRating?.toFixed(1) ?? 'N/A'} ({listing.totalReviews || 0})
          </Text>
        )}
        {listing.description && (
          <Text style={styles.body}>{listing.description}</Text>
        )}

        <Text style={styles.sectionTitle}>Reviews</Text>
        {loadingReviews ? (
          <Text style={styles.subtitle}>Loading reviews...</Text>
        ) : reviews.length === 0 ? (
          <Text style={styles.subtitle}>No reviews yet.</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <Text style={styles.reviewRating}>Rating: {review.overallRating}</Text>
              {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              <Text style={styles.reviewMeta}>{formatDate(review.createdAt)}</Text>
            </View>
          ))
        )}

        {reviews.length < reviewsTotal && (
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="Load more reviews"
            accessibilityRole="button"
            onPress={() => fetchReviews(reviewsPage + 1)}
          >
            <Text style={styles.secondaryButtonText}>Load more reviews</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.primaryButton}
          accessibilityLabel="Book now"
          accessibilityHint="Start booking this listing"
          accessibilityRole="button"
          onPress={() => navigation.navigate("BookingFlow", { listingId })}
        >
          <Text style={styles.primaryButtonText}>Book now</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  hero: {
    width: "100%",
    height: 240,
    backgroundColor: "#F3F4F6",
  },
  heroPlaceholder: {
    width: "100%",
    height: 240,
    backgroundColor: "#F3F4F6",
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 8,
  },
  body: {
    color: "#374151",
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 20,
    fontWeight: "700",
    color: "#111827",
  },
  reviewCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
  },
  reviewRating: {
    fontWeight: "600",
    color: "#111827",
  },
  reviewComment: {
    marginTop: 6,
    color: "#374151",
  },
  reviewMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#9CA3AF",
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
