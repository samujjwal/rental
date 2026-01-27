
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  emailVerified: 'emailVerified',
  emailVerificationToken: 'emailVerificationToken',
  passwordHash: 'passwordHash',
  firstName: 'firstName',
  lastName: 'lastName',
  phoneNumber: 'phoneNumber',
  phone: 'phone',
  phoneVerified: 'phoneVerified',
  dateOfBirth: 'dateOfBirth',
  profilePhotoUrl: 'profilePhotoUrl',
  bio: 'bio',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  postalCode: 'postalCode',
  country: 'country',
  idVerificationStatus: 'idVerificationStatus',
  idVerificationUrl: 'idVerificationUrl',
  governmentIdUrl: 'governmentIdUrl',
  governmentIdType: 'governmentIdType',
  governmentIdNumber: 'governmentIdNumber',
  stripeCustomerId: 'stripeCustomerId',
  stripeConnectId: 'stripeConnectId',
  stripeOnboardingComplete: 'stripeOnboardingComplete',
  stripeChargesEnabled: 'stripeChargesEnabled',
  stripePayoutsEnabled: 'stripePayoutsEnabled',
  role: 'role',
  status: 'status',
  preferredLanguage: 'preferredLanguage',
  preferredCurrency: 'preferredCurrency',
  timezone: 'timezone',
  mfaEnabled: 'mfaEnabled',
  mfaSecret: 'mfaSecret',
  passwordResetToken: 'passwordResetToken',
  passwordResetExpires: 'passwordResetExpires',
  lastLoginAt: 'lastLoginAt',
  lastLoginIp: 'lastLoginIp',
  averageRating: 'averageRating',
  totalReviews: 'totalReviews',
  responseRate: 'responseRate',
  responseTime: 'responseTime',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  refreshToken: 'refreshToken',
  expiresAt: 'expiresAt',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  logoUrl: 'logoUrl',
  websiteUrl: 'websiteUrl',
  businessType: 'businessType',
  taxId: 'taxId',
  email: 'email',
  phoneNumber: 'phoneNumber',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  postalCode: 'postalCode',
  country: 'country',
  stripeConnectId: 'stripeConnectId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrganizationMemberScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  role: 'role',
  permissions: 'permissions',
  invitedBy: 'invitedBy',
  joinedAt: 'joinedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  iconUrl: 'iconUrl',
  order: 'order',
  active: 'active',
  templateSchema: 'templateSchema',
  searchableFields: 'searchableFields',
  requiredFields: 'requiredFields',
  defaultPricingMode: 'defaultPricingMode',
  allowInstantBook: 'allowInstantBook',
  requiresDepositDefault: 'requiresDepositDefault',
  defaultDepositPercentage: 'defaultDepositPercentage',
  insuranceRequired: 'insuranceRequired',
  minimumInsuranceAmount: 'minimumInsuranceAmount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ListingScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  organizationId: 'organizationId',
  categoryId: 'categoryId',
  title: 'title',
  description: 'description',
  slug: 'slug',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  postalCode: 'postalCode',
  country: 'country',
  latitude: 'latitude',
  longitude: 'longitude',
  photos: 'photos',
  videos: 'videos',
  documents: 'documents',
  pricingMode: 'pricingMode',
  basePrice: 'basePrice',
  hourlyPrice: 'hourlyPrice',
  dailyPrice: 'dailyPrice',
  weeklyPrice: 'weeklyPrice',
  monthlyPrice: 'monthlyPrice',
  currency: 'currency',
  requiresDeposit: 'requiresDeposit',
  depositAmount: 'depositAmount',
  depositType: 'depositType',
  bookingMode: 'bookingMode',
  minBookingHours: 'minBookingHours',
  maxBookingDays: 'maxBookingDays',
  leadTime: 'leadTime',
  advanceNotice: 'advanceNotice',
  capacity: 'capacity',
  categorySpecificData: 'categorySpecificData',
  condition: 'condition',
  features: 'features',
  amenities: 'amenities',
  cancellationPolicyId: 'cancellationPolicyId',
  rules: 'rules',
  insurancePolicyId: 'insurancePolicyId',
  insuranceVerified: 'insuranceVerified',
  insuranceVerifiedAt: 'insuranceVerifiedAt',
  insuranceExpiresAt: 'insuranceExpiresAt',
  status: 'status',
  verificationStatus: 'verificationStatus',
  rejectionReason: 'rejectionReason',
  moderatedBy: 'moderatedBy',
  moderatedAt: 'moderatedAt',
  viewCount: 'viewCount',
  bookingCount: 'bookingCount',
  favoriteCount: 'favoriteCount',
  averageRating: 'averageRating',
  totalReviews: 'totalReviews',
  metaTitle: 'metaTitle',
  metaDescription: 'metaDescription',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.CancellationPolicyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  description: 'description',
  rules: 'rules',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AvailabilityScalarFieldEnum = {
  id: 'id',
  listingId: 'listingId',
  startDate: 'startDate',
  endDate: 'endDate',
  available: 'available',
  price: 'price',
  minStay: 'minStay',
  createdAt: 'createdAt'
};

exports.Prisma.FavoriteListingScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  listingId: 'listingId',
  createdAt: 'createdAt'
};

exports.Prisma.BookingScalarFieldEnum = {
  id: 'id',
  listingId: 'listingId',
  renterId: 'renterId',
  ownerId: 'ownerId',
  startDate: 'startDate',
  endDate: 'endDate',
  duration: 'duration',
  guestCount: 'guestCount',
  basePrice: 'basePrice',
  serviceFee: 'serviceFee',
  tax: 'tax',
  depositAmount: 'depositAmount',
  discountAmount: 'discountAmount',
  totalPrice: 'totalPrice',
  totalAmount: 'totalAmount',
  ownerEarnings: 'ownerEarnings',
  platformFee: 'platformFee',
  currency: 'currency',
  renterMessage: 'renterMessage',
  status: 'status',
  cancellationReason: 'cancellationReason',
  cancelledBy: 'cancelledBy',
  cancelledAt: 'cancelledAt',
  paymentIntentId: 'paymentIntentId',
  depositHoldId: 'depositHoldId',
  depositReleased: 'depositReleased',
  depositReleasedAt: 'depositReleasedAt',
  checkInTime: 'checkInTime',
  checkOutTime: 'checkOutTime',
  actualReturnTime: 'actualReturnTime',
  categoryData: 'categoryData',
  renterNotes: 'renterNotes',
  ownerNotes: 'ownerNotes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  confirmedAt: 'confirmedAt',
  completedAt: 'completedAt'
};

exports.Prisma.BookingStateHistoryScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  fromState: 'fromState',
  toState: 'toState',
  reason: 'reason',
  metadata: 'metadata',
  changedBy: 'changedBy',
  createdAt: 'createdAt'
};

exports.Prisma.LedgerEntryScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  accountType: 'accountType',
  side: 'side',
  amount: 'amount',
  currency: 'currency',
  transactionType: 'transactionType',
  description: 'description',
  referenceId: 'referenceId',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  settledAt: 'settledAt'
};

exports.Prisma.DepositHoldScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  amount: 'amount',
  currency: 'currency',
  paymentIntentId: 'paymentIntentId',
  status: 'status',
  authorizedAt: 'authorizedAt',
  capturedAt: 'capturedAt',
  releasedAt: 'releasedAt',
  deductedAmount: 'deductedAmount',
  deductionReason: 'deductionReason',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  amount: 'amount',
  currency: 'currency',
  stripePaymentIntentId: 'stripePaymentIntentId',
  stripeChargeId: 'stripeChargeId',
  status: 'status',
  failureReason: 'failureReason',
  processedAt: 'processedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefundScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  amount: 'amount',
  currency: 'currency',
  reason: 'reason',
  refundId: 'refundId',
  status: 'status',
  processedAt: 'processedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PayoutScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  amount: 'amount',
  currency: 'currency',
  transferId: 'transferId',
  status: 'status',
  failureReason: 'failureReason',
  createdAt: 'createdAt',
  processedAt: 'processedAt',
  paidAt: 'paidAt'
};

exports.Prisma.ReviewScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  listingId: 'listingId',
  reviewerId: 'reviewerId',
  revieweeId: 'revieweeId',
  type: 'type',
  overallRating: 'overallRating',
  accuracyRating: 'accuracyRating',
  communicationRating: 'communicationRating',
  cleanlinessRating: 'cleanlinessRating',
  valueRating: 'valueRating',
  title: 'title',
  content: 'content',
  response: 'response',
  respondedAt: 'respondedAt',
  status: 'status',
  flagged: 'flagged',
  flagReason: 'flagReason',
  moderatedBy: 'moderatedBy',
  moderatedAt: 'moderatedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConversationScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  listingId: 'listingId',
  type: 'type',
  subject: 'subject',
  lastMessageAt: 'lastMessageAt',
  lastMessagePreview: 'lastMessagePreview',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConversationParticipantScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  userId: 'userId',
  muted: 'muted',
  lastReadAt: 'lastReadAt',
  joinedAt: 'joinedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  senderId: 'senderId',
  type: 'type',
  content: 'content',
  attachments: 'attachments',
  metadata: 'metadata',
  status: 'status',
  createdAt: 'createdAt',
  editedAt: 'editedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.MessageReadReceiptScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  userId: 'userId',
  readAt: 'readAt'
};

exports.Prisma.ConditionReportScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  reportType: 'reportType',
  type: 'type',
  reportedBy: 'reportedBy',
  reportedAt: 'reportedAt',
  checklistData: 'checklistData',
  overallCondition: 'overallCondition',
  condition: 'condition',
  notes: 'notes',
  damages: 'damages',
  issuesFound: 'issuesFound',
  damageAmount: 'damageAmount',
  acknowledgedBy: 'acknowledgedBy',
  acknowledgedAt: 'acknowledgedAt',
  disputeRaised: 'disputeRaised',
  status: 'status',
  createdAt: 'createdAt',
  completedAt: 'completedAt'
};

exports.Prisma.ReportPhotoScalarFieldEnum = {
  id: 'id',
  reportId: 'reportId',
  url: 'url',
  thumbnailUrl: 'thumbnailUrl',
  caption: 'caption',
  tags: 'tags',
  metadata: 'metadata',
  order: 'order',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.DisputeScalarFieldEnum = {
  id: 'id',
  bookingId: 'bookingId',
  conditionReportId: 'conditionReportId',
  initiatorId: 'initiatorId',
  defendantId: 'defendantId',
  type: 'type',
  title: 'title',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  priority: 'priority',
  slaDeadline: 'slaDeadline',
  respondedAt: 'respondedAt',
  resolvedAt: 'resolvedAt',
  assignedTo: 'assignedTo',
  assignedAt: 'assignedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DisputeResponseScalarFieldEnum = {
  id: 'id',
  disputeId: 'disputeId',
  userId: 'userId',
  content: 'content',
  attachments: 'attachments',
  createdAt: 'createdAt'
};

exports.Prisma.DisputeEvidenceScalarFieldEnum = {
  id: 'id',
  disputeId: 'disputeId',
  uploadedBy: 'uploadedBy',
  type: 'type',
  url: 'url',
  description: 'description',
  metadata: 'metadata',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.DisputeTimelineEventScalarFieldEnum = {
  id: 'id',
  disputeId: 'disputeId',
  eventType: 'eventType',
  description: 'description',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.DisputeResolutionScalarFieldEnum = {
  id: 'id',
  disputeId: 'disputeId',
  outcome: 'outcome',
  summary: 'summary',
  refundAmount: 'refundAmount',
  payoutAdjustment: 'payoutAdjustment',
  actionsTaken: 'actionsTaken',
  resolvedBy: 'resolvedBy',
  resolvedAt: 'resolvedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  title: 'title',
  message: 'message',
  data: 'data',
  relatedId: 'relatedId',
  relatedType: 'relatedType',
  actionUrl: 'actionUrl',
  actionLabel: 'actionLabel',
  read: 'read',
  readAt: 'readAt',
  status: 'status',
  sentViaEmail: 'sentViaEmail',
  sentViaPush: 'sentViaPush',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  oldValues: 'oldValues',
  newValues: 'newValues',
  metadata: 'metadata',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.InsurancePolicyScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  listingId: 'listingId',
  policyNumber: 'policyNumber',
  provider: 'provider',
  type: 'type',
  coverageAmount: 'coverageAmount',
  effectiveDate: 'effectiveDate',
  expirationDate: 'expirationDate',
  documentUrl: 'documentUrl',
  certificateUrl: 'certificateUrl',
  status: 'status',
  verificationDate: 'verificationDate',
  verifiedBy: 'verifiedBy',
  notes: 'notes',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeviceTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  platform: 'platform',
  active: 'active',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserPreferencesScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  preferences: 'preferences',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.VerificationStatus = exports.$Enums.VerificationStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
};

exports.GovernmentIdType = exports.$Enums.GovernmentIdType = {
  PASSPORT: 'PASSPORT',
  DRIVERS_LICENSE: 'DRIVERS_LICENSE',
  NATIONAL_ID: 'NATIONAL_ID',
  OTHER: 'OTHER'
};

exports.UserRole = exports.$Enums.UserRole = {
  CUSTOMER: 'CUSTOMER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
  DELETED: 'DELETED'
};

exports.OrganizationStatus = exports.$Enums.OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED'
};

exports.OrgRole = exports.$Enums.OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER'
};

exports.PricingMode = exports.$Enums.PricingMode = {
  PER_HOUR: 'PER_HOUR',
  PER_DAY: 'PER_DAY',
  PER_WEEK: 'PER_WEEK',
  PER_MONTH: 'PER_MONTH',
  CUSTOM: 'CUSTOM'
};

exports.DepositType = exports.$Enums.DepositType = {
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  PERCENTAGE: 'PERCENTAGE'
};

exports.BookingMode = exports.$Enums.BookingMode = {
  INSTANT_BOOK: 'INSTANT_BOOK',
  REQUEST_TO_BOOK: 'REQUEST_TO_BOOK'
};

exports.ListingCondition = exports.$Enums.ListingCondition = {
  NEW: 'NEW',
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR'
};

exports.ListingStatus = exports.$Enums.ListingStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  REJECTED: 'REJECTED'
};

exports.CancellationPolicyType = exports.$Enums.CancellationPolicyType = {
  FLEXIBLE: 'FLEXIBLE',
  MODERATE: 'MODERATE',
  STRICT: 'STRICT',
  NON_REFUNDABLE: 'NON_REFUNDABLE'
};

exports.BookingStatus = exports.$Enums.BookingStatus = {
  DRAFT: 'DRAFT',
  PENDING_OWNER_APPROVAL: 'PENDING_OWNER_APPROVAL',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_RETURN_INSPECTION: 'AWAITING_RETURN_INSPECTION',
  COMPLETED: 'COMPLETED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED'
};

exports.LedgerSide = exports.$Enums.LedgerSide = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT'
};

exports.LedgerEntryStatus = exports.$Enums.LedgerEntryStatus = {
  PENDING: 'PENDING',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED'
};

exports.DepositStatus = exports.$Enums.DepositStatus = {
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.RefundStatus = exports.$Enums.RefundStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.PayoutStatus = exports.$Enums.PayoutStatus = {
  PENDING: 'PENDING',
  IN_TRANSIT: 'IN_TRANSIT',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.ReviewType = exports.$Enums.ReviewType = {
  LISTING_REVIEW: 'LISTING_REVIEW',
  RENTER_REVIEW: 'RENTER_REVIEW',
  OWNER_REVIEW: 'OWNER_REVIEW'
};

exports.ReviewStatus = exports.$Enums.ReviewStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED'
};

exports.ConversationType = exports.$Enums.ConversationType = {
  BOOKING: 'BOOKING',
  INQUIRY: 'INQUIRY',
  SUPPORT: 'SUPPORT',
  GENERAL: 'GENERAL'
};

exports.ConversationStatus = exports.$Enums.ConversationStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED'
};

exports.MessageType = exports.$Enums.MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
  SYSTEM: 'SYSTEM',
  BOOKING_UPDATE: 'BOOKING_UPDATE'
};

exports.MessageStatus = exports.$Enums.MessageStatus = {
  SENDING: 'SENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  DELETED: 'DELETED'
};

exports.ReportType = exports.$Enums.ReportType = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT'
};

exports.ReportStatus = exports.$Enums.ReportStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  DISPUTED: 'DISPUTED'
};

exports.DisputeType = exports.$Enums.DisputeType = {
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  MISSING_ITEMS: 'MISSING_ITEMS',
  CONDITION_MISMATCH: 'CONDITION_MISMATCH',
  REFUND_REQUEST: 'REFUND_REQUEST',
  PAYMENT_ISSUE: 'PAYMENT_ISSUE',
  OTHER: 'OTHER'
};

exports.DisputeStatus = exports.$Enums.DisputeStatus = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INVESTIGATING: 'INVESTIGATING',
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
  IN_MEDIATION: 'IN_MEDIATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

exports.DisputePriority = exports.$Enums.DisputePriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

exports.EvidenceType = exports.$Enums.EvidenceType = {
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
  RECEIPT: 'RECEIPT',
  OTHER: 'OTHER'
};

exports.ResolutionOutcome = exports.$Enums.ResolutionOutcome = {
  RESOLVED_INITIATOR_FAVOR: 'RESOLVED_INITIATOR_FAVOR',
  RESOLVED_DEFENDANT_FAVOR: 'RESOLVED_DEFENDANT_FAVOR',
  RESOLVED_COMPROMISE: 'RESOLVED_COMPROMISE',
  RESOLVED_NO_ACTION: 'RESOLVED_NO_ACTION',
  ESCALATED: 'ESCALATED',
  CANCELLED: 'CANCELLED'
};

exports.NotificationType = exports.$Enums.NotificationType = {
  BOOKING_REQUEST: 'BOOKING_REQUEST',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_REMINDER: 'BOOKING_REMINDER',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  VERIFICATION_COMPLETE: 'VERIFICATION_COMPLETE',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT'
};

exports.InsuranceStatus = exports.$Enums.InsuranceStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUIRED: 'REQUIRED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  Organization: 'Organization',
  OrganizationMember: 'OrganizationMember',
  Category: 'Category',
  Listing: 'Listing',
  CancellationPolicy: 'CancellationPolicy',
  Availability: 'Availability',
  FavoriteListing: 'FavoriteListing',
  Booking: 'Booking',
  BookingStateHistory: 'BookingStateHistory',
  LedgerEntry: 'LedgerEntry',
  DepositHold: 'DepositHold',
  Payment: 'Payment',
  Refund: 'Refund',
  Payout: 'Payout',
  Review: 'Review',
  Conversation: 'Conversation',
  ConversationParticipant: 'ConversationParticipant',
  Message: 'Message',
  MessageReadReceipt: 'MessageReadReceipt',
  ConditionReport: 'ConditionReport',
  ReportPhoto: 'ReportPhoto',
  Dispute: 'Dispute',
  DisputeResponse: 'DisputeResponse',
  DisputeEvidence: 'DisputeEvidence',
  DisputeTimelineEvent: 'DisputeTimelineEvent',
  DisputeResolution: 'DisputeResolution',
  Notification: 'Notification',
  AuditLog: 'AuditLog',
  InsurancePolicy: 'InsurancePolicy',
  DeviceToken: 'DeviceToken',
  UserPreferences: 'UserPreferences'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
