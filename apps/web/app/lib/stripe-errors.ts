import { StripeError } from "@stripe/stripe-js";

/**
 * Stripe Error Codes mapped to user-friendly messages
 * Based on Stripe's error documentation and UX best practices
 */
export const STRIPE_ERROR_MESSAGES: Record<
  string,
  { title: string; message: string; action: string }
> = {
  // Card errors
  card_declined: {
    title: "Payment Declined",
    message:
      "Your card was declined. Please try a different payment method or contact your bank.",
    action: "Try another card",
  },
  insufficient_funds: {
    title: "Insufficient Funds",
    message:
      "Your card has insufficient funds. Please try a different payment method.",
    action: "Try another card",
  },
  lost_card: {
    title: "Card Reported Lost",
    message:
      "This card has been reported lost or stolen. Please use a different card.",
    action: "Try another card",
  },
  stolen_card: {
    title: "Card Reported Stolen",
    message: "This card has been reported stolen. Please use a different card.",
    action: "Try another card",
  },
  expired_card: {
    title: "Card Expired",
    message:
      "Your card has expired. Please check the expiration date or use a different card.",
    action: "Update card details",
  },
  incorrect_cvc: {
    title: "Security Code Incorrect",
    message:
      "Your card's security code (CVC) is incorrect. Please check and try again.",
    action: "Check CVC and retry",
  },
  processing_error: {
    title: "Processing Error",
    message:
      "An error occurred while processing your payment. Please try again.",
    action: "Retry payment",
  },
  issuer_not_available: {
    title: "Bank Unavailable",
    message:
      "Your bank is temporarily unavailable. Please wait a moment and try again.",
    action: "Retry in a few moments",
  },
  try_again_later: {
    title: "Payment Failed",
    message:
      "The payment could not be processed right now. Please try again later.",
    action: "Retry payment",
  },

  // Validation errors
  invalid_number: {
    title: "Invalid Card Number",
    message:
      "The card number you entered is invalid. Please check and try again.",
    action: "Check card number",
  },
  invalid_expiry_month: {
    title: "Invalid Expiry Month",
    message:
      "The expiry month you entered is invalid. Please check and try again.",
    action: "Update expiry date",
  },
  invalid_expiry_year: {
    title: "Invalid Expiry Year",
    message:
      "The expiry year you entered is invalid. Please check and try again.",
    action: "Update expiry date",
  },
  invalid_cvc: {
    title: "Invalid Security Code",
    message:
      "The security code (CVC) you entered is invalid. Please check and try again.",
    action: "Check CVC",
  },
  incorrect_number: {
    title: "Incorrect Card Number",
    message:
      "The card number you entered appears to be incorrect. Please check and try again.",
    action: "Check card number",
  },
  incomplete_number: {
    title: "Incomplete Card Number",
    message:
      "The card number you entered is incomplete. Please enter all digits.",
    action: "Complete card number",
  },
  incomplete_cvc: {
    title: "Incomplete Security Code",
    message:
      "The security code (CVC) you entered is incomplete. Please enter all digits.",
    action: "Complete CVC",
  },
  incomplete_expiry: {
    title: "Incomplete Expiry Date",
    message:
      "The expiry date you entered is incomplete. Please enter both month and year.",
    action: "Complete expiry date",
  },

  // Authentication errors
  authentication_required: {
    title: "Authentication Required",
    message:
      "Your bank requires additional authentication. Please complete the verification.",
    action: "Complete authentication",
  },

  // Account errors
  account_country_invalid_address: {
    title: "Invalid Address",
    message:
      "Your billing address appears to be invalid. Please check and try again.",
    action: "Update address",
  },
  account_invalid: {
    title: "Account Issue",
    message:
      "There is an issue with the payment account. Please try a different payment method.",
    action: "Try another card",
  },

  // Amount errors
  amount_too_large: {
    title: "Amount Too Large",
    message:
      "The payment amount exceeds your card limit. Please try a different payment method.",
    action: "Try another card",
  },
  amount_too_small: {
    title: "Amount Too Small",
    message:
      "The payment amount is below the minimum allowed. Please check the amount.",
    action: "Check amount",
  },

  // Rate limit
  rate_limit: {
    title: "Too Many Attempts",
    message: "Too many payment attempts. Please wait a moment and try again.",
    action: "Wait and retry",
  },

  // Generic errors
  api_connection_error: {
    title: "Connection Error",
    message:
      "We could not connect to the payment provider. Please check your connection and try again.",
    action: "Check connection and retry",
  },
  api_error: {
    title: "Payment Error",
    message: "An error occurred with the payment provider. Please try again.",
    action: "Retry payment",
  },
  idempotency_error: {
    title: "Duplicate Payment",
    message:
      "This payment appears to be a duplicate. Please check your booking status before retrying.",
    action: "Check booking status",
  },
  missing: {
    title: "Payment Information Missing",
    message:
      "Required payment information is missing. Please check all fields and try again.",
    action: "Complete all fields",
  },
};

/**
 * Translated Stripe error with user-friendly messaging
 */
export interface TranslatedStripeError {
  code: string;
  title: string;
  message: string;
  action: string;
  technicalDetails?: string;
  retryable: boolean;
}

/**
 * Translate Stripe error to user-friendly error
 */
export function translateStripeError(
  error: StripeError | unknown
): TranslatedStripeError {
  // Handle Stripe error objects
  if (error && typeof error === "object" && "code" in error) {
    const stripeError = error as StripeError;
    const code = stripeError.code || "unknown_error";

    const translation = STRIPE_ERROR_MESSAGES[code];

    if (translation) {
      return {
        code,
        title: translation.title,
        message: translation.message,
        action: translation.action,
        technicalDetails: stripeError.message,
        retryable: isRetryableStripeError(code),
      };
    }

    // Fallback for unmapped codes
    return {
      code,
      title: "Payment Error",
      message:
        stripeError.message ||
        "An unexpected error occurred with your payment. Please try again.",
      action: "Retry payment",
      technicalDetails: stripeError.decline_code || stripeError.message,
      retryable: true,
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      code: "unknown_error",
      title: "Payment Error",
      message:
        error.message ||
        "An unexpected error occurred with your payment. Please try again.",
      action: "Retry payment",
      technicalDetails: error.message,
      retryable: true,
    };
  }

  // Ultimate fallback
  return {
    code: "unknown_error",
    title: "Payment Error",
    message:
      "An unexpected error occurred with your payment. Please try again.",
    action: "Retry payment",
    retryable: true,
  };
}

/**
 * Check if a Stripe error code is retryable
 */
function isRetryableStripeError(code: string): boolean {
  const retryableCodes = new Set([
    "processing_error",
    "issuer_not_available",
    "try_again_later",
    "api_connection_error",
    "api_error",
    "rate_limit",
  ]);

  return retryableCodes.has(code);
}

/**
 * Get the appropriate error action for a Stripe error
 */
export function getStripeErrorAction(
  error: StripeError | unknown
): "retry" | "new_card" | "contact_bank" | "check_status" {
  const translated = translateStripeError(error);

  if (translated.code === "idempotency_error") {
    return "check_status";
  }

  if (
    translated.action.includes("another card") ||
    translated.action.includes("card")
  ) {
    return "new_card";
  }

  if (
    translated.code === "card_declined" ||
    translated.code === "stolen_card" ||
    translated.code === "lost_card"
  ) {
    return "contact_bank";
  }

  if (translated.retryable) {
    return "retry";
  }

  return "new_card";
}

/**
 * Format card number with spaces for readability
 */
export function formatCardNumber(value: string): string {
  const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || "";
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(" ");
  } else {
    return v;
  }
}

/**
 * Detect card type from number
 */
export function detectCardType(cardNumber: string): string | null {
  const number = cardNumber.replace(/\s+/g, "");

  const patterns = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
    diners: /^3(?:0[0-5]|[68])/,
    jcb: /^(?:2131|1800|35)/,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(number)) {
      return type;
    }
  }

  return null;
}

/**
 * Validate expiry date format and future date
 */
export function isValidExpiryDate(month: string, year: string): boolean {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
    return false;
  }

  // Full year (2024) or short year (24)
  const fullYear = y < 100 ? 2000 + y : y;

  if (fullYear < currentYear) {
    return false;
  }

  if (fullYear === currentYear && m < currentMonth) {
    return false;
  }

  return true;
}

export default translateStripeError;
