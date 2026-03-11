import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { BookingSummary, ReviewResponse } from '~/types';
import { formatDate } from '../utils/date';

export function ReviewsScreen() {
  const { user } = useAuth();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"renter" | "owner">("renter");
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [status, setStatus] = useState("");

  const fetchUserReviews = async () => {
    if (!user) return;
    setLoadingReviews(true);
    try {
        const response = await mobileClient.getUserReviews(user.id, "received");
        setReviews(response.reviews || []);
    } catch (err) {
      setReviews([]);
      setStatus("Unable to load your reviews.");
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchBookings = async (mode: "renter" | "owner") => {
    if (!user) {
      return;
    }
    setLoadingBookings(true);
    setStatus("");
    try {
      const data =
        mode === "owner"
          ? await mobileClient.getHostBookings()
          : await mobileClient.getMyBookings();
      setBookings(data || []);
    } catch (err) {
      setBookings([]);
      setStatus("Unable to load bookings.");
    } finally {
      setLoadingBookings(false);
    }
  };

  const submitReview = async () => {
    if (!user) {
      setStatus("Sign in to leave a review.");
      return;
    }
    if (!selectedBookingId) {
      setStatus("Select a completed booking to review.");
      return;
    }
    setStatus("Submitting review...");
    try {
      await mobileClient.createReview({
        bookingId: selectedBookingId,
        reviewType: reviewMode === "owner" ? "OWNER_TO_RENTER" : "RENTER_TO_OWNER",
        overallRating: Number(rating),
        comment,
      });
      setStatus("Review submitted.");
      setComment("");
      setRating("5");
      fetchUserReviews();
    } catch (err) {
      setStatus("Unable to submit review.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserReviews();
    }, [user])
  );

  useFocusEffect(
    useCallback(() => {
      fetchBookings(reviewMode);
    }, [user, reviewMode])
  );

  const completedBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const statusValue = (booking.status || "").toUpperCase();
      return statusValue.includes("COMPLETED") || statusValue.includes("SETTLED");
    });
  }, [bookings]);

  const selectedBooking = completedBookings.find((b) => b.id === selectedBookingId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reviews</Text>
      {!user ? (
        <Text style={styles.status}>Sign in to view and leave reviews.</Text>
      ) : (
        <>
          <Text style={styles.section}>Your Reviews</Text>
          {loadingReviews ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <FlatList
              data={reviews}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.rating}>Rating: {item.overallRating}</Text>
                  {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
                  <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.status}>No reviews yet.</Text>}
            />
          )}

          <Text style={styles.section}>Leave a Review</Text>
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, reviewMode === "renter" && styles.modeButtonActive]}
              onPress={() => setReviewMode("renter")}
            >
              <Text style={[styles.modeButtonText, reviewMode === "renter" && styles.modeButtonTextActive]}>
                As Renter
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, reviewMode === "owner" && styles.modeButtonActive]}
              onPress={() => setReviewMode("owner")}
            >
              <Text style={[styles.modeButtonText, reviewMode === "owner" && styles.modeButtonTextActive]}>
                As Owner
              </Text>
            </Pressable>
          </View>

          {loadingBookings ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : completedBookings.length === 0 ? (
            <Text style={styles.status}>No completed bookings available for review.</Text>
          ) : (
            <View style={styles.bookingList}>
              {completedBookings.map((booking) => (
                <Pressable
                  key={booking.id}
                  style={[
                    styles.bookingItem,
                    selectedBookingId === booking.id && styles.bookingItemActive,
                  ]}
                  onPress={() => setSelectedBookingId(booking.id)}
                >
                  <Text style={styles.bookingTitle}>
                    {booking.listing?.title || "Listing"}
                  </Text>
                  <Text style={styles.bookingMeta}>
                    {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {selectedBooking ? (
            <View style={styles.selectionCard}>
              <Text style={styles.selectionTitle}>Selected Booking</Text>
              <Text style={styles.selectionText}>
                {selectedBooking.listing?.title || "Listing"}
              </Text>
              <Text style={styles.selectionText}>
                {formatDate(selectedBooking.startDate)} → {formatDate(selectedBooking.endDate)}
              </Text>
            </View>
          ) : null}

          <TextInput
            value={rating}
            onChangeText={(text) => {
              if (text === '') { setRating(''); return; }
              const num = parseInt(text, 10);
              if (isNaN(num)) return;
              setRating(String(Math.min(5, Math.max(1, num))));
            }}
            placeholder="Rating (1-5)"
            keyboardType="number-pad"
            style={styles.input}
          />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comment"
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={submitReview}>
            <Text style={styles.primaryButtonText}>Submit review</Text>
          </Pressable>

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  section: {
    marginTop: 16,
    fontWeight: "600",
    color: "#111827",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modeButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  modeButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  secondaryButton: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  bookingList: {
    marginTop: 8,
    gap: 8,
  },
  bookingItem: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  bookingItemActive: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },
  bookingTitle: {
    fontWeight: "600",
    color: "#111827",
  },
  bookingMeta: {
    marginTop: 4,
    color: "#6B7280",
  },
  selectionCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#F9FAFB",
  },
  selectionTitle: {
    fontWeight: "600",
    color: "#111827",
  },
  selectionText: {
    marginTop: 4,
    color: "#6B7280",
  },
  status: {
    marginTop: 8,
    color: "#6B7280",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  rating: {
    fontWeight: "600",
    color: "#111827",
  },
  comment: {
    marginTop: 6,
    color: "#374151",
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    color: "#9CA3AF",
  },
});
