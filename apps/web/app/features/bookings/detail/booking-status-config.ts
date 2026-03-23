/**
 * booking-status-config
 *
 * Display constants for booking status badges and the booking timeline.
 * Extracted from the BookingDetail route to keep it thin.
 */
import { Clock, CheckCircle, Package, FileText } from "lucide-react";

export const STATUS_COLORS: Record<string, string> = {
  pending_owner_approval: "bg-yellow-100 text-yellow-800",
  pending_payment: "bg-orange-100 text-orange-800",
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  return_requested: "bg-amber-100 text-amber-800",
  completed: "bg-muted text-foreground",
  settled: "bg-muted text-foreground",
  cancelled: "bg-red-100 text-red-800",
  payment_failed: "bg-red-100 text-red-800",
  disputed: "bg-red-100 text-red-800",
  refunded: "bg-blue-100 text-blue-800",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

export const TIMELINE_STEPS = [
  { status: "pending_owner_approval", label: "Booking Requested", icon: Clock },
  { status: "pending_payment", label: "Pending Payment", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle },
  { status: "active", label: "In Progress", icon: Package },
  { status: "return_requested", label: "Return Requested", icon: FileText },
  { status: "completed", label: "Completed", icon: CheckCircle },
];
