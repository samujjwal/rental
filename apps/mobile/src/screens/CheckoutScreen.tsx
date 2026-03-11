import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { mobileClient } from '../api/client';
import { useAuth } from '../api/authContext';
import type { BookingDetail } from '~/types';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { FormButton } from '../components/FormInput';
import { DetailPageSkeleton } from '../components/LoadingSkeleton';
import { showSuccess, showError, showApiError } from '../components/Toast';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';

// Stripe imports — wrapped in try/catch for environments where it's not available
let useStripe: any;
let StripeProvider: any;
try {
  const stripe = require('@stripe/stripe-react-native');
  useStripe = stripe.useStripe;
  StripeProvider = stripe.StripeProvider;
} catch {
  // Stripe not available — will fall back to web checkout
}

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function CheckoutContent({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  // Guard: bookingId is required
  useEffect(() => {
    if (!bookingId) {
      navigation.goBack();
    }
  }, [bookingId, navigation]);

  const stripe = useStripe?.();

  const fetchBooking = useCallback(async () => {
    try {
      const data = await mobileClient.getBooking(bookingId);
      setBooking(data);
    } catch {
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!user) return;
    fetchBooking();
  }, [user, fetchBooking]);

  const handleNativePayment = useCallback(async () => {
    if (!stripe || !bookingId || paying) return;

    setPaying(true);
    try {
      // Create payment intent on backend
      const intent = await mobileClient.createPaymentIntent(bookingId);

      if (!intent.clientSecret) {
        showError('Payment setup failed. Please try again.');
        return;
      }

      // Initialize payment sheet
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: intent.clientSecret,
        merchantDisplayName: 'GharBatai',
        allowsDelayedPaymentMethods: false,
        returnURL: 'gharbatai://checkout/complete',
      });

      if (initError) {
        showError(initError.message || 'Could not initialize payment');
        return;
      }

      // Present payment sheet
      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User cancelled — do nothing
          return;
        }
        showError(presentError.message || 'Payment failed');
        return;
      }

      // Payment succeeded
      showSuccess('Payment successful!');
      navigation.navigate('BookingDetail', { bookingId });
    } catch (err) {
      showApiError(err);
    } finally {
      setPaying(false);
    }
  }, [stripe, bookingId, paying, navigation]);

  const handleWebFallback = useCallback(async () => {
    const { Linking } = require('react-native');
    const WEB_BASE_URL = require('../config').WEB_BASE_URL;
    const checkoutUrl = `${WEB_BASE_URL}/checkout/${bookingId}`;
    try {
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert('Error', 'Unable to open checkout page.');
    }
  }, [bookingId]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign In Required</Text>
        <Text style={styles.emptySubtitle}>Sign in to complete checkout.</Text>
        <FormButton title="Sign In" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: spacing.md }}>
          <DetailPageSkeleton />
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Booking Not Found</Text>
        <FormButton title="Go Back" variant="outline" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const hasStripe = !!stripe && !!STRIPE_PUBLISHABLE_KEY;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Checkout</Text>

        {/* Booking summary card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Item</Text>
            <Text style={styles.value}>{booking.listing?.title || 'Listing'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Dates</Text>
            <Text style={styles.value}>
              {formatDate(booking.startDate)} {'\u2192'} {formatDate(booking.endDate)}
            </Text>
          </View>
          {(booking.totalPrice ?? booking.totalAmount) != null && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(booking.totalPrice ?? booking.totalAmount)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Payment buttons */}
        <View style={styles.paymentSection}>
          {hasStripe ? (
            <FormButton
              title={paying ? 'Processing...' : 'Pay with Card'}
              onPress={handleNativePayment}
              loading={paying}
              disabled={paying}
            />
          ) : (
            <FormButton
              title="Open Secure Checkout"
              onPress={handleWebFallback}
            />
          )}

          {hasStripe && (
            <View style={styles.webFallbackRow}>
              <FormButton
                title="Pay via Web Instead"
                variant="ghost"
                onPress={handleWebFallback}
              />
            </View>
          )}
        </View>

        {/* Security note */}
        <Text style={styles.securityNote}>
          {'\uD83D\uDD12'} Your payment is securely processed by Stripe.
          We never store your card details.
        </Text>
      </ScrollView>
    </View>
  );
}

export function CheckoutScreen(props: Props) {
  if (StripeProvider && STRIPE_PUBLISHABLE_KEY) {
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <CheckoutContent {...props} />
      </StripeProvider>
    );
  }
  return <CheckoutContent {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  heading: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  paymentSection: {
    marginBottom: spacing.lg,
  },
  webFallbackRow: {
    marginTop: spacing.sm,
  },
  securityNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
