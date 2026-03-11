import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { ListingDetail } from '~/types';
import { formatCurrency } from '../utils/currency';
import { pricingModeLabel } from '../utils/pricing';


type Props = NativeStackScreenProps<RootStackParamList, "BookingFlow">;

export function BookingFlowScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [listingId] = useState(route.params?.listingId || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startDateObj, setStartDateObj] = useState<Date>(new Date());
  const [endDateObj, setEndDateObj] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [guestCount, setGuestCount] = useState("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(false);

  const formatDateStr = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  const onStartDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowStartPicker(Platform.OS === 'ios'); // iOS keeps picker open
    if (date) {
      setStartDateObj(date);
      setStartDate(formatDateStr(date));
      setAvailability("idle");
      setStatus("");
    }
  };

  const onEndDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (date) {
      setEndDateObj(date);
      setEndDate(formatDateStr(date));
      setAvailability("idle");
      setStatus("");
    }
  };

  /** Calculate estimated pricing breakdown from listing data and selected dates */
  const pricingBreakdown = React.useMemo(() => {
    if (!listing || !startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const basePrice = listing.pricePerDay ?? listing.basePrice ?? 0;
    const subtotal = basePrice * days;
    // Use server-provided rates when available, fall back to defaults
    const serviceFeeRate = listing.serviceFeeRate ?? (listing.fees?.serviceFeePercent ? (listing.fees.serviceFeePercent / 100) : 0.05);
    const taxRate = listing.taxRate ?? (listing.fees?.taxPercent ? (listing.fees.taxPercent / 100) : 0.13);
    const serviceFee = Math.round(subtotal * serviceFeeRate * 100) / 100;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + serviceFee + tax) * 100) / 100;
    return { days, basePrice, subtotal, serviceFee, serviceFeeRate, tax, taxRate, total };
  }, [listing, startDate, endDate]);

  useEffect(() => {
    if (!listingId) return;
    const loadListing = async () => {
      setLoadingListing(true);
      try {
        const response = await mobileClient.getListing(listingId);
        setListing(response);
      } catch (err) {
        setListing(null);
      } finally {
        setLoadingListing(false);
      }
    };
    loadListing();
  }, [listingId]);

  const handleCreateBooking = async () => {
    if (!user) {
      setStatus("Sign in to create a booking.");
      return;
    }
    if (!listingId || !startDate || !endDate) {
      setStatus("Listing ID, start date, and end date are required.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setStatus("Please enter valid dates in YYYY-MM-DD format.");
      return;
    }
    if (start < today) {
      setStatus("Start date cannot be in the past.");
      return;
    }
    if (end <= start) {
      setStatus("End date must be after start date.");
      return;
    }
    if (availability !== "available") {
      setStatus("Please check availability before booking.");
      return;
    }

    setStatus("Creating booking...");
    try {
      const booking = await mobileClient.createBooking({
        listingId,
        startDate,
        endDate,
        guestCount: Number(guestCount),
        message,
      });
      setStatus("Booking created. Redirecting to checkout...");
      navigation.navigate("Checkout", { bookingId: booking.id });
    } catch (err) {
      setStatus("Unable to create booking.");
    }
  };

  const handleCheckAvailability = async () => {
    if (!listingId || !startDate || !endDate) {
      setStatus("Listing ID, start date, and end date are required.");
      return;
    }
    const startCheck = new Date(startDate);
    const endCheck = new Date(endDate);
    const todayCheck = new Date();
    todayCheck.setHours(0, 0, 0, 0);
    if (isNaN(startCheck.getTime()) || isNaN(endCheck.getTime())) {
      setStatus("Please enter valid dates in YYYY-MM-DD format.");
      return;
    }
    if (startCheck < todayCheck) {
      setStatus("Start date cannot be in the past.");
      return;
    }
    if (endCheck <= startCheck) {
      setStatus("End date must be after start date.");
      return;
    }
    setAvailability("checking");
    setStatus("Checking availability...");
    try {
      const response = await mobileClient.checkAvailability(listingId, startDate, endDate);
      if (response.available) {
        setAvailability("available");
        setStatus("Dates are available.");
      } else {
        setAvailability("unavailable");
        setStatus(response.message || "Selected dates are not available.");
      }
    } catch (err) {
      setAvailability("unavailable");
      setStatus("Unable to check availability.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Book a Listing</Text>
      {loadingListing ? (
        <Text style={styles.status}>Loading listing...</Text>
      ) : listing ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{listing.title}</Text>
          {listing.location?.city ? (
            <Text style={styles.summaryText}>
              {listing.location.city}
              {listing.location.state ? `, ${listing.location.state}` : ""}
            </Text>
          ) : null}
          {listing.pricePerDay != null || listing.basePrice != null ? (
            <Text style={styles.summaryText}>
              {formatCurrency(listing.pricePerDay ?? listing.basePrice)}{pricingModeLabel(listing.pricingMode)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.status}>Unable to load listing.</Text>
      )}
      <Pressable
        style={styles.dateButton}
        onPress={() => setShowStartPicker(true)}
        accessibilityLabel="Select start date"
        accessibilityHint="Opens a date picker to choose the booking start date"
      >
        <Text style={styles.dateButtonText}>
          {startDate ? `Start: ${startDate}` : "Select start date"}
        </Text>
      </Pressable>
      {showStartPicker && (
        <DateTimePicker
          value={startDateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={onStartDateChange}
        />
      )}
      <Pressable
        style={styles.dateButton}
        onPress={() => setShowEndPicker(true)}
        accessibilityLabel="Select end date"
        accessibilityHint="Opens a date picker to choose the booking end date"
      >
        <Text style={styles.dateButtonText}>
          {endDate ? `End: ${endDate}` : "Select end date"}
        </Text>
      </Pressable>
      {showEndPicker && (
        <DateTimePicker
          value={endDateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={startDateObj}
          onChange={onEndDateChange}
        />
      )}
      <TextInput
        value={guestCount}
        onChangeText={setGuestCount}
        placeholder="Guest count"
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Message to host (optional)"
        style={styles.input}
      />
      <Pressable style={styles.secondaryButton} onPress={handleCheckAvailability} accessibilityLabel="Check availability" accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>
          {availability === "checking" ? "Checking..." : "Check availability"}
        </Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={handleCreateBooking} accessibilityLabel="Create booking" accessibilityHint="Submits the booking request" accessibilityRole="button">
        <Text style={styles.primaryButtonText}>Create booking</Text>
      </Pressable>
      {pricingBreakdown && (
        <View style={styles.pricingBreakdown}>
          <Text style={styles.pricingTitle}>Estimated Price Breakdown</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>{formatCurrency(pricingBreakdown.basePrice)} x {pricingBreakdown.days} day(s)</Text>
            <Text style={styles.pricingValue}>{formatCurrency(pricingBreakdown.subtotal)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Service fee</Text>
            <Text style={styles.pricingValue}>{formatCurrency(pricingBreakdown.serviceFee)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Tax ({Math.round((pricingBreakdown.taxRate) * 100)}%)</Text>
            <Text style={styles.pricingValue}>{formatCurrency(pricingBreakdown.tax)}</Text>
          </View>
          <View style={[styles.pricingRow, styles.pricingTotal]}>
            <Text style={styles.pricingTotalLabel}>Total</Text>
            <Text style={styles.pricingTotalValue}>{formatCurrency(pricingBreakdown.total)}</Text>
          </View>
        </View>
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  summary: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  summaryTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  summaryText: {
    color: "#6B7280",
    marginBottom: 2,
  },
  primaryButton: {
    marginTop: 12,
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
    marginTop: 4,
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
  status: {
    marginTop: 12,
    color: "#6B7280",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  dateButtonText: {
    color: "#111827",
    fontSize: 14,
  },
  pricingBreakdown: {
    marginTop: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pricingTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pricingLabel: {
    color: "#6B7280",
  },
  pricingValue: {
    color: "#111827",
  },
  pricingTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 4,
  },
  pricingTotalLabel: {
    fontWeight: "700",
    color: "#111827",
  },
  pricingTotalValue: {
    fontWeight: "700",
    color: "#111827",
  },
});
