import React from 'react';
import { Loader2, Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { translateStripeError, TranslatedStripeError } from '~/lib/stripe-errors';

export type PaymentProcessingState =
  | 'idle'
  | 'validating'
  | 'processing'
  | 'confirming'
  | 'success'
  | 'error';

interface PaymentProcessingOverlayProps {
  state: PaymentProcessingState;
  error?: Error | unknown;
  amount?: number;
  currency?: string;
  onRetry?: () => void;
  onTryAnotherCard?: () => void;
  className?: string;
}

/**
 * Payment Processing Overlay Component
 * Provides clear visual feedback during payment processing to prevent duplicate submissions
 * and improve user trust during sensitive transactions.
 */
export function PaymentProcessingOverlay({
  state,
  error,
  amount,
  currency = 'USD',
  onRetry,
  onTryAnotherCard,
  className
}: PaymentProcessingOverlayProps) {
  const translatedError = error ? translateStripeError(error) : null;

  // Don't render for idle state
  if (state === 'idle') {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-processing-title"
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <PaymentProcessingContent
          state={state}
          error={translatedError}
          amount={amount}
          currency={currency}
          onRetry={onRetry}
          onTryAnotherCard={onTryAnotherCard}
        />
      </div>
    </div>
  );
}

function PaymentProcessingContent({
  state,
  error,
  amount,
  currency,
  onRetry,
  onTryAnotherCard
}: {
  state: PaymentProcessingState;
  error: TranslatedStripeError | null;
  amount?: number;
  currency: string;
  onRetry?: () => void;
  onTryAnotherCard?: () => void;
}) {
  const formatAmount = (amount?: number, currency?: string) => {
    if (amount === undefined || amount === null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  switch (state) {
    case 'validating':
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="payment-processing-title" className="text-lg font-semibold">
              Validating Payment Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your payment information...
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" aria-hidden="true" />
            <span>Secure, encrypted connection</span>
          </div>
        </div>
      );

    case 'processing':
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="payment-processing-title" className="text-lg font-semibold">
              Processing Your Payment
            </h2>
            <p className="text-sm text-muted-foreground">
              {amount && `Charging ${formatAmount(amount, currency)} to your card...`}
              {!amount && 'Processing your payment...'}
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a few moments. Please do not close this window or refresh the page.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>Bank-grade encryption • PCI compliant</span>
          </div>
          <div className="w-full space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Processing with your bank...</p>
          </div>
        </div>
      );

    case 'confirming':
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="payment-processing-title" className="text-lg font-semibold">
              Confirming Your Booking
            </h2>
            <p className="text-sm text-muted-foreground">
              Finalizing your reservation and sending confirmation...
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>Payment successful • Creating booking</span>
          </div>
        </div>
      );

    case 'success':
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="payment-processing-title" className="text-lg font-semibold text-green-600 dark:text-green-400">
              Payment Successful!
            </h2>
            <p className="text-sm text-muted-foreground">
              {amount && `We've charged ${formatAmount(amount, currency)} to your card.`}
              Your booking has been confirmed and confirmation details have been sent to your email.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>Booking confirmed • Email sent</span>
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="payment-processing-title" className="text-lg font-semibold text-destructive">
              {error?.title || 'Payment Failed'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'An error occurred while processing your payment. Please try again.'}
            </p>
            {error?.technicalDetails && (
              <p className="text-xs text-muted-foreground">
                Error code: {error.code}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2">
            {error && (
              <>
                {(error.code === 'card_declined' ||
                  error.code === 'insufficient_funds' ||
                  error.code === 'expired_card' ||
                  error.code === 'lost_card' ||
                  error.code === 'stolen_card') && onTryAnotherCard && (
                    <button
                      onClick={onTryAnotherCard}
                      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Try Another Card
                    </button>
                  )}
                {error.retryable && onRetry && (
                  <button
                    onClick={onRetry}
                    className={cn(
                      "w-full rounded-md px-4 py-2 text-sm font-medium",
                      (error.code === 'card_declined')
                        ? "border border-input bg-background hover:bg-accent"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {error.action || 'Try Again'}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" aria-hidden="true" />
            <span>No charges have been made to your card</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Hook for managing payment processing state
 * Ensures proper state transitions and prevents duplicate submissions
 */
export function usePaymentProcessingState() {
  const [state, setState] = React.useState<PaymentProcessingState>('idle');
  const [error, setError] = React.useState<Error | unknown>(null);
  const processingRef = React.useRef(false);

  const startValidating = React.useCallback(() => {
    if (processingRef.current) return false;
    setState('validating');
    setError(null);
    return true;
  }, []);

  const startProcessing = React.useCallback(() => {
    if (processingRef.current) return false;
    processingRef.current = true;
    setState('processing');
    return true;
  }, []);

  const startConfirming = React.useCallback(() => {
    setState('confirming');
    return true;
  }, []);

  const setSuccess = React.useCallback(() => {
    processingRef.current = false;
    setState('success');
    return true;
  }, []);

  const setErrorState = React.useCallback((err: Error | unknown) => {
    processingRef.current = false;
    setError(err);
    setState('error');
    return true;
  }, []);

  const reset = React.useCallback(() => {
    processingRef.current = false;
    setState('idle');
    setError(null);
  }, []);

  const isProcessing = state === 'processing' || state === 'validating' || state === 'confirming';

  return {
    state,
    error,
    isProcessing,
    startValidating,
    startProcessing,
    startConfirming,
    setSuccess,
    setError: setErrorState,
    reset
  };
}

export default PaymentProcessingOverlay;
