/**
 * useBookingActions
 *
 * Encapsulates the state-machine dispatch logic for booking detail actions.
 * Wires UI events to form submissions so the route component stays thin.
 */
import { useCallback } from "react";
import type { NavigateFunction } from "react-router";
import type { CancelIntent } from "./useBookingModals";

interface UseBookingActionsOptions {
  navigate: NavigateFunction;
  setCancelIntent: (intent: CancelIntent) => void;
  setShowCancelModal: (open: boolean) => void;
  setShowReviewModal: (open: boolean) => void;
}

export function useBookingActions({
  navigate,
  setCancelIntent,
  setShowCancelModal,
  setShowReviewModal,
}: UseBookingActionsOptions) {
  const createHiddenInput = (name: string, value: string): HTMLInputElement => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    return input;
  };

  /** Map BookingStateMachine action names to form intent strings and trigger the right UX flow. */
  const handleStateAction = useCallback(
    (action: string, bookingId: string) => {
      // Modal-driven actions
      if (action === "reject") {
        setCancelIntent("reject");
        setShowCancelModal(true);
        return;
      }
      if (action === "reject_return") {
        setCancelIntent("reject_return");
        setShowCancelModal(true);
        return;
      }
      if (action === "cancel") {
        setCancelIntent("cancel");
        setShowCancelModal(true);
        return;
      }
      if (action === "review") {
        setShowReviewModal(true);
        return;
      }
      if (action === "pay") {
        navigate(`/checkout/${bookingId}`);
        return;
      }

      // Direct form submission for the rest
      const intentMap: Record<string, string> = {
        approve: "confirm",
        start: "start",
        requestReturn: "request_return",
        complete: "complete",
      };
      const mappedIntent = intentMap[action];
      if (!mappedIntent) return;

      const form = document.createElement("form");
      form.method = "post";
      form.action = `/bookings/${bookingId}`;
      form.appendChild(createHiddenInput("intent", mappedIntent));
      document.body.appendChild(form);
      form.submit();
    },
    [navigate, setCancelIntent, setShowCancelModal, setShowReviewModal],
  );

  return { handleStateAction };
}
