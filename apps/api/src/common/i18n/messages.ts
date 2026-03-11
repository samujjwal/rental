/**
 * Canonical API message keys.
 *
 * English is the source-of-truth. Other locales are registered at
 * boot time via `registerLocale()` — this lets operators add new
 * languages without touching this file.
 */
const EN_MESSAGES = {
  // ── Auth ──────────────────────────────────────────────
  'auth.invalidCredentials': 'Invalid credentials',
  'auth.unauthorized': 'You must be logged in to access this resource',
  'auth.forbidden': 'You do not have permission to access this resource',
  'auth.tokenExpired': 'Your session has expired. Please log in again.',
  'auth.emailTaken': 'An account with this email already exists',
  'auth.userNotFound': 'User not found',
  'auth.invalidToken': 'Invalid or expired token',
  'auth.mfaRequired': 'Two-factor authentication code required',
  'auth.mfaInvalid': 'Invalid two-factor authentication code',
  'auth.accountLocked': 'Account is locked. Please try again later.',
  'auth.emailNotVerified': 'Please verify your email address first',
  'auth.accountSuspended': 'Account is suspended or banned',
  'auth.invalidRefreshToken': 'Invalid refresh token',
  'auth.refreshTokenExpired': 'Refresh token expired',
  'auth.passwordIncorrect': 'Current password is incorrect',
  'auth.mfaAlreadyEnabled': 'MFA is already enabled',
  'auth.mfaSetupNotInitiated': 'MFA setup not initiated',
  'auth.invalidVerificationCode': 'Invalid verification code',
  'auth.emailAlreadyVerified': 'Email already verified',
  'auth.noPhoneOnFile': 'No phone number on file',
  'auth.phoneAlreadyVerified': 'Phone already verified',
  'auth.codeExpired': 'Code expired. Request a new one.',
  'auth.devLoginOnly': 'Dev login is only available in development',
  'auth.noDevUser': 'No active user available for dev login',
  'auth.invalidPassword': 'Invalid password',
  'auth.notAuthenticated': 'User not authenticated',
  'auth.insufficientPermissions': 'Insufficient permissions for this action',
  'auth.sessionExpired': 'Session expired or invalidated',
  'auth.oauthNotConfigured': 'OAuth provider is not configured',
  'auth.oauthInvalidToken': 'Invalid OAuth token',
  'auth.oauthTokenMismatch': 'OAuth token audience mismatch',
  'auth.otpExpired': 'OTP expired or not found. Please request a new one.',
  'auth.otpInvalid': 'Invalid OTP code',
  'auth.otpTooManyAttempts': 'Too many incorrect attempts. Please request a new OTP.',
  'auth.googleNotConfigured': 'Google OAuth is not configured',
  'auth.googleAudienceMismatch': 'Google token audience mismatch',
  'auth.invalidGoogleToken': 'Invalid Google token',
  'auth.appleNotConfigured': 'Apple Sign-In is not configured on this server',
  'auth.appleKeysFetchFailed': 'Failed to fetch Apple public keys',
  'auth.appleKeyNotFound': 'Apple token signing key not found',
  'auth.appleSignatureFailed': 'Apple token signature verification failed',
  'auth.appleTokenExpired': 'Apple token expired',
  'auth.appleInvalidIssuer': 'Invalid Apple token issuer',
  'auth.appleAudienceMismatch': 'Apple token audience mismatch',
  'auth.appleInvalidFormat': 'Invalid Apple token format',
  'auth.appleVerificationFailed': 'Apple token verification failed',
  'auth.invalidOtp': 'Invalid OTP code',
  'auth.tooManyOtpAttempts': 'Too many incorrect attempts. Please request a new OTP.',
  'auth.userNotFoundOrInactive': 'User not found or inactive',

  // ── Booking ───────────────────────────────────────────
  'booking.notFound': 'Booking not found',
  'booking.expired': 'This booking has expired',
  'booking.cannotCancel': 'This booking cannot be cancelled',
  'booking.alreadyConfirmed': 'This booking is already confirmed',
  'booking.invalidDates': 'Invalid booking dates',
  'booking.endBeforeStart': 'End date must be after start date',
  'booking.unavailable': 'This listing is not available for the selected dates',
  'booking.invalidStatus': 'Invalid booking status transition',
  'booking.unauthorizedAction': 'You are not authorized for this booking action',
  'booking.cannotBookOwn': 'Cannot book your own listing',
  'booking.notReady': 'Booking is not ready for payment',
  'booking.preconditionFailed': 'Preconditions not met for this transition',
  'booking.startInPast': 'Start date cannot be in the past',
  'booking.overlap': 'Availability period overlaps with existing rules',

  // ── Listing ───────────────────────────────────────────
  'listing.notFound': 'Listing not found',
  'listing.unauthorized': 'You are not authorized to modify this listing',
  'listing.invalidData': 'Invalid listing data',
  'listing.alreadyPublished': 'This listing is already published',
  'listing.cannotPublish': 'This listing cannot be published in its current state',
  'listing.categoryRequired': 'Category is required',
  'listing.invalidCategory': 'Invalid category',
  'listing.draftOnly': 'Only draft listings can be published',
  'listing.verificationRequired': 'Property must be verified before activation',
  'listing.hasActiveBookings': 'Cannot delete listing with active bookings',
  'listing.notOwner': 'Not the listing owner',
  'listing.cannotPause': 'This listing cannot be paused in its current state',
  'listing.cannotActivate': 'This listing cannot be activated in its current state',

  // ── Dispute ───────────────────────────────────────────
  'dispute.notFound': 'Dispute not found',
  'dispute.alreadyResolved': 'This dispute has already been resolved',
  'dispute.unauthorized': 'You are not authorized to manage this dispute',
  'dispute.alreadyExists': 'An active dispute already exists for this booking',
  'dispute.adminOnly': 'Only admins can update dispute status',
  'dispute.adminRequired': 'Admin access required',
  'dispute.invalidTransition': 'This status transition is not allowed for the current dispute state',

  // ── Payment ───────────────────────────────────────────
  'payment.failed': 'Payment processing failed',
  'payment.notFound': 'Payment not found',
  'payment.refundFailed': 'Refund processing failed',
  'payment.invalidAmount': 'Invalid payment amount',
  'payment.ownerNotSetup': 'Owner has not set up payments',
  'payment.noDeposit': 'No deposit required for this booking',
  'payment.depositNotFound': 'Deposit hold not found',
  'payment.depositNotAuthorized': 'Deposit not in AUTHORIZED status',
  'payment.noCustomer': 'No Stripe customer account found. Please create one first.',
  'payment.noCustomerAccount': 'No Stripe customer account found. Please create one first.',
  'payment.webhookNotConfigured': 'Stripe webhook secret is not configured',
  'payment.webhookSecretMissing': 'Stripe webhook secret is not configured',
  'payment.missingSignatureHeader': 'Missing stripe-signature header',
  'payment.missingRequestBody': 'Missing request body',
  'payment.paymentNotFound': 'No payment found for this booking',
  'payment.unauthorizedTaxAccess': 'Cannot access another user\'s tax summary',
  'payment.unauthorized1099Access': 'Cannot generate tax form for another user',
  'payment.notEligibleFor1099': 'User is not eligible for 1099 form',
  'payment.ownerNotConnected': 'Owner has not connected a payout account',
  'payment.ownerNotVerified': 'Owner account not verified',
  'payment.noPendingEarnings': 'No pending earnings to payout',
  'payment.insufficientFunds': 'Insufficient funds',
  'payment.notEligible1099': 'User is not eligible for 1099 form',
  'payment.belowThreshold': 'Income is below 1099 threshold',

  // ── Upload ────────────────────────────────────────────
  'upload.tooLarge': 'File size exceeds the maximum allowed limit',
  'upload.invalidType': 'Invalid file type',
  'upload.noFile': 'No file provided',
  'upload.noFiles': 'No files provided',
  'upload.invalidImageType': 'Invalid image type',
  'upload.invalidDocType': 'Unsupported document type',

  // ── Messaging ─────────────────────────────────────────
  'message.notFound': 'Message not found',
  'message.conversationNotFound': 'Conversation not found',
  'message.unauthorized': 'You are not part of this conversation',
  'message.cannotStartConversation': 'Cannot start conversation with this user',
  'message.cannotMessageSelf': 'Cannot start a conversation with yourself',
  'message.cannotDeleteOthers': 'Can only delete your own messages',

  // ── Organization ──────────────────────────────────────
  'organization.notFound': 'Organization not found',
  'organization.unauthorized': 'You are not authorized for this organization',
  'organization.memberExists': 'User is already a member of this organization',
  'organization.alreadyOwned': 'User already owns an organization',
  'organization.cannotRemoveOwner': 'Cannot remove organization owner',
  'organization.cannotChangeOwnerRole': 'Cannot change owner role',
  'organization.notMember': 'Not a member of this organization',
  'organization.memberNotFound': 'Member not found',
  'organization.invitationNotFound': 'No invitation found',
  'organization.ownerCannotDecline': 'Organization owners cannot decline their own membership',
  'organization.idOrTokenRequired': 'Organization ID or token is required',
  'organization.ownerOnlyDeactivate': 'Only the organization owner can deactivate it',

  // ── Review ────────────────────────────────────────────
  'review.notFound': 'Review not found',
  'review.alreadyReviewed': 'You have already reviewed this booking',
  'review.unauthorized': 'You are not authorized to review this booking',
  'review.completedOnly': 'Can only review completed bookings',
  'review.invalidType': 'Invalid review type',
  'review.editWindow': 'Reviews can only be edited within 7 days',
  'review.ownOnly': 'You can only view your own reviews',
  'review.invalidRating': 'Ratings must be between 1 and 5',
  'review.renterOnly': 'Only the renter can review the owner',
  'review.ownerOnly': 'Only the owner can review the renter',
  'review.windowExpired': 'The 30-day review window has expired for this booking',

  // ── Insurance ─────────────────────────────────────────
  'insurance.notFound': 'Insurance policy not found',
  'insurance.alreadyActive': 'An active insurance policy already exists',
  'insurance.expired': 'Insurance policy is already expired',
  'insurance.invalidDates': 'Effective date must be before expiration date',
  'insurance.ownListingsOnly': 'You can only upload insurance for your own listings',

  // ── Category ──────────────────────────────────────────
  'category.requiredFields': 'Name, slug, and templateSchema are required',
  'category.hasSubcategories': 'Cannot delete category with nested subcategories',
  'category.attributeNotFound': 'Attribute value not found',

  // ── Notification ──────────────────────────────────────
  'notification.userNotFound': 'User not found',
  'notification.notFound': 'Notification not found',
  'notification.invalidTwilioSignature': 'Invalid Twilio signature',
  'notification.missingTwilioSignature': 'Missing Twilio signature header',

  // ── Moderation ────────────────────────────────────────
  'moderation.notFound': 'Queue item not found',
  'moderation.queueItemNotFound': 'Queue item not found',

  // ── Admin ─────────────────────────────────────────────
  'admin.required': 'Admin access required',
  'admin.accessRequired': 'Admin access required',
  'admin.statusRequired': 'Status is required and must be a string',
  'admin.invalidFilters': 'Invalid filters format',
  'admin.invalidFiltersFormat': 'Invalid filters format',
  'admin.cannotSuspendAdmin': 'Cannot suspend admin users',
  'admin.userNotFound': 'User not found',
  'admin.betweenRequiresTwoValues': 'BETWEEN operator requires array with exactly 2 values',
  'admin.notBetweenRequiresTwoValues': 'NOT_BETWEEN operator requires array with exactly 2 values',

  // ── KYC ───────────────────────────────────────────────
  'kyc.documentNotFound': 'Document not found',
  'kyc.alreadyReviewed': 'Document has already been reviewed',

  // ── Validation ────────────────────────────────────────
  'validation.required': 'This field is required',
  'validation.invalidEmail': 'Please enter a valid email address',
  'validation.invalidPhone': 'Please enter a valid phone number',
  'validation.invalidPhoneFormat': 'Invalid phone number format',
  'validation.passwordTooWeak':
    'Password must be at least 8 characters with uppercase, lowercase, and number',
  'validation.invalidDateFormat': 'Invalid date format',
  'validation.nonEmptyArray': 'Must be a non-empty array',
  'validation.statusRequired': 'Status is required and must be a string',
  'validation.titleTooShort': 'Title must be at least 3 characters',
  'validation.urlsRequired': 'URLs must be a non-empty array',
  'validation.listingIdsRequired': 'Listing IDs must be a non-empty array',
  'validation.organizationIdRequired': 'Organization ID is required',

  // ── Favorite ──────────────────────────────────────────
  'favorite.notFound': 'Favorite not found',

  // ── Common ────────────────────────────────────────────
  'common.notFound': 'Resource not found',
  'common.serverError': 'An unexpected error occurred. Please try again later.',
  'common.badRequest': 'Invalid request',
  'common.tooManyRequests': 'Too many requests. Please try again later.',
  'common.notAuthorized': 'Not authorized',
} as const;

/** Nepali translations (shipped by default). */
const NE_MESSAGES: Partial<Record<MessageKey, string>> = {
  'auth.invalidCredentials': 'अमान्य इमेल वा पासवर्ड',
  'auth.unauthorized':
    'यो स्रोत पहुँच गर्न तपाईंले लग इन गर्नुपर्छ',
  'auth.forbidden': 'यो स्रोत पहुँच गर्न तपाईंको अनुमति छैन',
  'auth.tokenExpired':
    'तपाईंको सत्र समाप्त भएको छ। कृपया पुन: लग इन गर्नुहोस्।',
  'auth.emailTaken': 'यो इमेलमा पहिले नै खाता छ',
  'auth.userNotFound': 'प्रयोगकर्ता भेटिएन',
  'auth.invalidToken': 'अमान्य वा म्याद सकिएको टोकन',
  'auth.mfaRequired': 'दुई-कारक प्रमाणीकरण कोड आवश्यक छ',
  'auth.mfaInvalid': 'अमान्य दुई-कारक प्रमाणीकरण कोड',
  'booking.notFound': 'बुकिङ भेटिएन',
  'booking.expired': 'यो बुकिङको म्याद सकिएको छ',
  'booking.cannotCancel': 'यो बुकिङ रद्द गर्न सकिँदैन',
  'booking.alreadyConfirmed': 'यो बुकिङ पहिले नै पुष्टि भएको छ',
  'booking.invalidDates': 'अमान्य बुकिङ मितिहरू',
  'booking.unavailable':
    'यो सूची चयन गरिएको मितिहरूमा उपलब्ध छैन',
  'listing.notFound': 'सूची भेटिएन',
  'listing.unauthorized':
    'यो सूची परिमार्जन गर्न तपाईं अधिकृत हुनुहुन्न',
  'listing.invalidData': 'अमान्य सूची डाटा',
  'dispute.notFound': 'विवाद भेटिएन',
  'dispute.alreadyResolved': 'यो विवाद पहिले नै समाधान भएको छ',
  'payment.failed': 'भुक्तानी प्रशोधन असफल भयो',
  'payment.notFound': 'भुक्तानी भेटिएन',
  'upload.tooLarge': 'फाइल साइज अधिकतम सीमा भन्दा बढी छ',
  'upload.invalidType': 'अमान्य फाइल प्रकार',
  'validation.required': 'यो फिल्ड आवश्यक छ',
  'validation.invalidEmail':
    'कृपया मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्',
  'validation.invalidPhone':
    'कृपया मान्य फोन नम्बर प्रविष्ट गर्नुहोस्',
  'validation.passwordTooWeak':
    'पासवर्ड कम्तीमा ८ वर्णको हुनुपर्छ ठूलो अक्षर, सानो अक्षर, र अंकसहित',
  'common.notFound': 'स्रोत भेटिएन',
  'common.serverError':
    'अप्रत्याशित त्रुटि भयो। कृपया पछि पुन: प्रयास गर्नुहोस्।',
  'common.badRequest': 'अमान्य अनुरोध',
  'common.tooManyRequests':
    'धेरै अनुरोधहरू। कृपया पछि पुन: प्रयास गर्नुहोस्।',
};

// ── Runtime locale registry ──────────────────────────────
type LocaleDict = Partial<Record<MessageKey, string>>;
const localeRegistry = new Map<string, LocaleDict>();
localeRegistry.set('ne', NE_MESSAGES);

/**
 * Register a new locale's translations at runtime (e.g. from a JSON file
 * loaded during bootstrap, or from the database).
 */
export function registerLocale(locale: string, messages: LocaleDict): void {
  localeRegistry.set(locale, { ...localeRegistry.get(locale), ...messages });
}

// ── Public types & accessor ──────────────────────────────
export type MessageKey = keyof typeof EN_MESSAGES;
export type SupportedLocale = string; // extensible — any registered locale

/** Backward-compatible constant for code that imports API_MESSAGES directly. */
export const API_MESSAGES = {
  get en() {
    return EN_MESSAGES;
  },
  get ne() {
    return NE_MESSAGES;
  },
};

export function getLocalizedMessage(
  key: MessageKey,
  locale: SupportedLocale = 'en',
): string {
  if (locale === 'en') return EN_MESSAGES[key] ?? key;
  const dict = localeRegistry.get(locale);
  return dict?.[key] ?? EN_MESSAGES[key] ?? key;
}
