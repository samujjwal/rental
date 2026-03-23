/**
 * useBookingModals
 *
 * Manages the cancel / reject-return and review modal state for the BookingDetail
 * route. Extracted to keep the route component thin.
 */
import { useState } from "react";

export type CancelIntent = "cancel" | "reject" | "reject_return";

export interface UseBookingModalsResult {
  // Cancel / reject modal
  showCancelModal: boolean;
  setShowCancelModal: React.Dispatch<React.SetStateAction<boolean>>;
  cancelReason: string;
  setCancelReason: React.Dispatch<React.SetStateAction<string>>;
  cancelIntent: CancelIntent;
  setCancelIntent: React.Dispatch<React.SetStateAction<CancelIntent>>;
  // Review modal
  showReviewModal: boolean;
  setShowReviewModal: React.Dispatch<React.SetStateAction<boolean>>;
  rating: number;
  setRating: React.Dispatch<React.SetStateAction<number>>;
  review: string;
  setReview: React.Dispatch<React.SetStateAction<string>>;
  /** Reset all modal state to initial values. */
  resetModals: () => void;
}

export function useBookingModals(): UseBookingModalsResult {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelIntent, setCancelIntent] = useState<CancelIntent>("cancel");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const resetModals = () => {
    setShowCancelModal(false);
    setCancelReason("");
    setCancelIntent("cancel");
    setShowReviewModal(false);
    setRating(5);
    setReview("");
  };

  return {
    showCancelModal, setShowCancelModal,
    cancelReason, setCancelReason,
    cancelIntent, setCancelIntent,
    showReviewModal, setShowReviewModal,
    rating, setRating,
    review, setReview,
    resetModals,
  };
}
