-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'HOST', 'ADMIN', 'SUPER_ADMIN', 'CUSTOMER', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'STUDIO', 'CONDO', 'TOWNHOUSE', 'COTTAGE', 'CABIN', 'LOFT', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'UNAVAILABLE', 'DRAFT', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'PENDING', 'PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'PAYMENT_FAILED', 'DISPUTED', 'COMPLETED', 'AWAITING_RETURN_INSPECTION', 'REFUNDED', 'SETTLED');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST', 'INSTANT_BOOK');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('PER_NIGHT', 'PER_MONTH', 'PER_HOUR', 'PER_DAY', 'PER_WEEK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('FIXED', 'PERCENTAGE', 'NONE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('LISTING_REVIEW', 'RENTER_REVIEW', 'OWNER_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'FLAGGED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'HELD', 'RELEASED', 'CAPTURED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'IN_TRANSIT', 'COMPLETED', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('REVENUE', 'EXPENSE', 'LIABILITY', 'ASSET', 'EQUITY', 'CASH', 'RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PLATFORM_FEE', 'SERVICE_FEE', 'PAYMENT', 'REFUND', 'PAYOUT', 'DEPOSIT_HOLD', 'OWNER_EARNING', 'DEPOSIT_RELEASE', 'DISPUTE');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'POSTED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_REQUEST', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'PAYMENT_RECEIVED', 'REVIEW_RECEIVED', 'MESSAGE_RECEIVED', 'SYSTEM_UPDATE', 'SYSTEM_ANNOUNCEMENT', 'MARKETING', 'PAYOUT_PROCESSED', 'VERIFICATION_COMPLETE', 'DISPUTE_OPENED', 'DISPUTE_UPDATED', 'NEW_MESSAGE', 'LISTING_APPROVED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('PROPERTY_DAMAGE', 'LIABILITY', 'TRIP_CANCELLATION', 'MEDICAL');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('BOOKING_CONFIRMATION', 'BOOKING_CANCELLATION', 'PAYMENT_CONFIRMATION', 'PAYMENT_RECEIPT', 'WELCOME', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'LISTING_APPROVED', 'LISTING_REJECTED', 'REVIEW_REMINDER', 'PAYOUT_NOTIFICATION', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'SYSTEM_NOTIFICATION');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('GENERAL', 'BOOKING', 'DISPUTE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('PROPERTY_DAMAGE', 'PAYMENT_ISSUE', 'CANCELLATION', 'CLEANING_FEE', 'RULES_VIOLATION', 'MISSING_ITEMS', 'CONDITION_MISMATCH', 'REFUND_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DisputePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'CHARGE_BACK', 'COMPENSATION', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IdentityDocumentType" AS ENUM ('DRIVERS_LICENSE', 'PASSPORT', 'NATIONAL_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityMode" AS ENUM ('DATE_RANGE', 'TIME_SLOT', 'CALENDAR');

-- CreateEnum
CREATE TYPE "AvailabilitySlotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'BOOKED', 'BLOCKED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "PriceLineType" AS ENUM ('BASE_RATE', 'DURATION_DISCOUNT', 'CLEANING_FEE', 'SERVICE_FEE', 'PLATFORM_FEE', 'SECURITY_DEPOSIT', 'INSURANCE', 'TAX', 'DELIVERY_FEE', 'LATE_FEE', 'DAMAGE_FEE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TAX', 'FEE', 'PRICING', 'CANCELLATION', 'BOOKING_CONSTRAINT', 'COMPLIANCE', 'CURRENCY', 'IDENTITY');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('DYNAMIC', 'SEASONAL', 'OCCUPANCY', 'LAST_MINUTE', 'EARLY_BIRD', 'COMPETITOR', 'SURGE', 'LOYALTY');

-- CreateEnum
CREATE TYPE "PricingStrategy" AS ENUM ('MULTIPLIER', 'FIXED_OFFSET', 'PERCENTAGE', 'FLOOR_CEILING', 'TIERED');

-- CreateEnum
CREATE TYPE "TrustScoreType" AS ENUM ('HOST_RELIABILITY', 'RENTER_RELIABILITY', 'PAYMENT_RELIABILITY', 'COMMUNICATION', 'OVERALL');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('NEW', 'BASIC', 'ESTABLISHED', 'TRUSTED', 'SUPERHOST');

-- CreateEnum
CREATE TYPE "ComplianceCheckType" AS ENUM ('IDENTITY_VERIFICATION', 'TAX_REGISTRATION', 'BUSINESS_LICENSE', 'INSURANCE_COVERAGE', 'PROPERTY_PERMIT', 'SAFETY_INSPECTION', 'DATA_PRIVACY', 'AML_CHECK', 'SANCTIONS_CHECK', 'AGE_VERIFICATION');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'EXPIRED', 'WAIVED', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'FUNDED', 'PARTIALLY_RELEASED', 'RELEASED', 'DISPUTED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('PEER', 'SUPPORT', 'MEDIATOR', 'SENIOR_MEDIATOR', 'LEGAL', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('GENERAL', 'BOOKING_ASSISTANT', 'HOST_ADVISOR', 'DISPUTE_GUIDE', 'CONCIERGE');

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'ESCALATED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExpansionStatus" AS ENUM ('EVALUATED', 'APPROVED', 'IN_PROGRESS', 'LAUNCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('TEXT', 'MAP', 'IMAGE', 'SEMANTIC', 'VOICE');

-- CreateEnum
CREATE TYPE "ReputationTier" AS ENUM ('NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'SUPERHOST');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT,
    "profilePhotoUrl" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "averageRating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION,
    "responseTime" TEXT,
    "stripeCustomerId" TEXT,
    "stripeConnectId" TEXT,
    "stripeChargesEnabled" BOOLEAN,
    "stripePayoutsEnabled" BOOLEAN,
    "stripeOnboardingComplete" BOOLEAN,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN,
    "mfaEnabled" BOOLEAN,
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "mfaSecret" TEXT,
    "mfaBackupCodes" TEXT[],
    "idVerificationStatus" TEXT,
    "idVerificationUrl" TEXT,
    "governmentIdNumber" TEXT,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "googleId" TEXT,
    "appleId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionId" TEXT,
    "subscriptionPlan" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "type" "PropertyType" NOT NULL,
    "bookingMode" "BookingMode" NOT NULL DEFAULT 'REQUEST',
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "condition" "PropertyCondition",
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "maxGuests" INTEGER,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "securityDeposit" DECIMAL(65,30),
    "cleaningFee" DECIMAL(65,30),
    "amenities" TEXT[],
    "features" TEXT[],
    "photos" TEXT[],
    "rules" TEXT[],
    "cancellationPolicyId" TEXT,
    "categoryId" TEXT,
    "organizationId" TEXT,
    "ownerId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "instantBookable" BOOLEAN NOT NULL DEFAULT false,
    "minStayNights" INTEGER NOT NULL DEFAULT 1,
    "maxStayNights" INTEGER,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "weeklyDiscount" INTEGER,
    "monthlyDiscount" INTEGER,
    "serviceFee" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "lastBookedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "searchVector" tsvector,
    "embedding" vector(1536),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "pricingMode" "PricingMode",
    "searchableFields" TEXT[],
    "requiredFields" TEXT[],
    "templateSchema" TEXT,
    "dailyPrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "ownerId" TEXT,
    "stripeConnectId" TEXT,
    "businessType" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "securityDeposit" DECIMAL(65,30),
    "cleaningFee" DECIMAL(65,30),
    "serviceFee" DECIMAL(65,30),
    "taxAmount" DECIMAL(65,30),
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "chargeId" TEXT,
    "refundId" TEXT,
    "specialRequests" TEXT,
    "guestNotes" TEXT,
    "ownerNotes" TEXT,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "ownerEarnings" DECIMAL(65,30),
    "platformFee" DECIMAL(65,30),
    "depositAmount" DECIMAL(65,30),
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "metadata" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "listingId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "rating" SMALLINT NOT NULL,
    "overallRating" SMALLINT,
    "accuracyRating" SMALLINT,
    "communicationRating" SMALLINT,
    "cleanlinessRating" SMALLINT,
    "valueRating" SMALLINT,
    "locationRating" SMALLINT,
    "checkInRating" SMALLINT,
    "comment" TEXT,
    "response" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentIntentId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "chargeId" TEXT,
    "stripeChargeId" TEXT,
    "refundId" TEXT,
    "fee" DECIMAL(65,30),
    "netAmount" DECIMAL(65,30),
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "refundId" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_holds" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "stripeId" TEXT,
    "paymentIntentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "deductedAmount" DECIMAL(65,30),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeId" TEXT,
    "transferId" TEXT,
    "paidAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "accountId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "price" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_contents" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT,
    "highlights" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_versions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attribute_definitions" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT,
    "validation" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "helpText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_attribute_values" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "inventoryUnitId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilitySlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "price" DECIMAL(65,30),
    "currency" TEXT NOT NULL,
    "bookingId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rate_snapshots" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "rateSource" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_price_breakdowns" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "lineType" "PriceLineType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "metadata" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_price_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_state_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "actionUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "status" TEXT,
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "sentViaPush" BOOLEAN NOT NULL DEFAULT false,
    "sentViaSMS" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "IdentityDocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptBookings" BOOLEAN NOT NULL DEFAULT false,
    "instantBook" BOOLEAN NOT NULL DEFAULT false,
    "bookingMode" TEXT,
    "minBookingDuration" INTEGER NOT NULL DEFAULT 1,
    "maxBookingDuration" INTEGER NOT NULL DEFAULT 30,
    "advanceBookingNotice" INTEGER NOT NULL DEFAULT 24,
    "preferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fullRefundHours" INTEGER NOT NULL DEFAULT 24,
    "partialRefundHours" INTEGER NOT NULL DEFAULT 48,
    "partialRefundPercent" DECIMAL(65,30) NOT NULL DEFAULT 0.5,
    "noRefundHours" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_reports" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "checkIn" BOOLEAN NOT NULL DEFAULT false,
    "checkOut" BOOLEAN NOT NULL DEFAULT false,
    "photos" TEXT[],
    "notes" TEXT,
    "damages" TEXT,
    "signature" TEXT,
    "status" TEXT,
    "reportType" TEXT,
    "checklistData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condition_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "bookingId" TEXT,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InsuranceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "coverage" DECIMAL(65,30) NOT NULL,
    "coverageAmount" DECIMAL(65,30),
    "premium" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "documents" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "propertyId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "claimAmount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAmount" DECIMAL(65,30),
    "rejectionReason" TEXT,
    "documents" TEXT[],
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "description" TEXT,
    "variables" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "listingId" TEXT,
    "type" "ConversationType" NOT NULL DEFAULT 'GENERAL',
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachments" TEXT[],
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "conditionReportId" TEXT,
    "initiatorId" TEXT NOT NULL,
    "defendantId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "title" TEXT NOT NULL,
    "type" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "DisputePriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_responses" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_timeline_events" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_resolutions" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "type" "ResolutionType" NOT NULL,
    "outcome" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "details" TEXT,
    "resolvedBy" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "state" VARCHAR(10),
    "city" VARCHAR(100),
    "jurisdiction" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "appliesTo" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "country" VARCHAR(3) NOT NULL DEFAULT '*',
    "state" VARCHAR(20),
    "city" VARCHAR(100),
    "jurisdictionPriority" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "supersedesId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_audit_log" (
    "id" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "context" JSONB NOT NULL,
    "contextHash" VARCHAR(64) NOT NULL,
    "candidateRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eliminatedRules" JSONB NOT NULL DEFAULT '[]',
    "decision" JSONB NOT NULL,
    "explanation" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "entityType" VARCHAR(30),
    "entityId" TEXT,
    "evaluationMs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyRuleId" TEXT,

    CONSTRAINT "policy_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_config" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "nameLocal" VARCHAR(50),
    "symbol" VARCHAR(10) NOT NULL,
    "symbolLocal" VARCHAR(10),
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "symbolPosition" VARCHAR(6) NOT NULL DEFAULT 'before',
    "groupingSep" VARCHAR(2) NOT NULL DEFAULT ',',
    "decimalSep" VARCHAR(2) NOT NULL DEFAULT '.',
    "intlLocale" VARCHAR(15),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_config_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "locale_config" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "nativeName" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(3) NOT NULL DEFAULT 'ltr',
    "fallback" VARCHAR(10) NOT NULL DEFAULT 'en',
    "dateFormat" VARCHAR(20) NOT NULL DEFAULT 'yyyy-MM-dd',
    "timeFormat" VARCHAR(20) NOT NULL DEFAULT 'HH:mm',
    "numberGrouping" VARCHAR(10) NOT NULL DEFAULT ',',
    "decimalSeparator" VARCHAR(2) NOT NULL DEFAULT '.',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locale_config_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "country_config" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "nameLocal" VARCHAR(100),
    "defaultCurrency" VARCHAR(3) NOT NULL,
    "defaultLocale" VARCHAR(10) NOT NULL,
    "defaultTimezone" VARCHAR(50) NOT NULL,
    "phonePrefix" VARCHAR(5),
    "addressFormat" JSONB NOT NULL DEFAULT '{}',
    "supportedPaymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "compliancePackVersion" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_config_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "categoryId" TEXT,
    "country" VARCHAR(3),
    "name" VARCHAR(200) NOT NULL,
    "type" "PricingRuleType" NOT NULL,
    "strategy" "PricingStrategy" NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoreType" "TrustScoreType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "tier" "TrustTier" NOT NULL DEFAULT 'NEW',
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(30) NOT NULL,
    "entityId" TEXT NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "checkType" "ComplianceCheckType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB NOT NULL DEFAULT '{}',
    "severity" VARCHAR(20),
    "expiresAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_metrics" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "period" VARCHAR(20) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "releaseCondition" TEXT,
    "holdUntil" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerId" VARCHAR(50),
    "externalId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_escalations" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "fromLevel" "EscalationLevel" NOT NULL,
    "toLevel" "EscalationLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "escalatedBy" TEXT,
    "assignedTo" TEXT,
    "deadline" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_health_metrics" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "date" DATE NOT NULL,
    "supplyCount" INTEGER NOT NULL DEFAULT 0,
    "demandCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "avgOccupancyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplyGrowthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demandGrowthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgBookingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_activation_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "targetSegment" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "hostsTargeted" INTEGER NOT NULL DEFAULT 0,
    "hostsActivated" INTEGER NOT NULL DEFAULT 0,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "host_activation_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL DEFAULT 'GENERAL',
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedIntent" TEXT,
    "satisfaction" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_turns" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "toolCalls" JSONB,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_forecasts" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "category" TEXT,
    "forecastDate" DATE NOT NULL,
    "horizon" TEXT NOT NULL,
    "predictedDemand" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "actualDemand" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_signals" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "signalType" TEXT NOT NULL,
    "signalValue" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_opportunities" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "marketSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regulatoryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "infrastructureScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localizationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "competitorDensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ExpansionStatus" NOT NULL DEFAULT 'EVALUATED',
    "requiresCodeChange" BOOLEAN NOT NULL DEFAULT false,
    "requiresArchChange" BOOLEAN NOT NULL DEFAULT false,
    "policyPackOnly" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "query" TEXT,
    "searchType" "SearchType" NOT NULL DEFAULT 'TEXT',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "clickedListings" JSONB NOT NULL DEFAULT '[]',
    "bookedListingId" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_search_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredLocations" JSONB NOT NULL DEFAULT '[]',
    "preferredCategories" JSONB NOT NULL DEFAULT '[]',
    "priceRange" JSONB NOT NULL DEFAULT '{}',
    "recentSearches" JSONB NOT NULL DEFAULT '[]',
    "clickHistory" JSONB NOT NULL DEFAULT '[]',
    "embedding" vector(384),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_search_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_recommendations" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "recommendedPrice" DOUBLE PRECISION NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "demandLevel" TEXT NOT NULL,
    "occupancyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "competitorAvg" DOUBLE PRECISION,
    "seasonalFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "modelVersion" TEXT NOT NULL,
    "accepted" BOOLEAN,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_signals" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "deviceFingerprint" TEXT,
    "ipAddress" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_fingerprints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "screenRes" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "ipAddresses" JSONB NOT NULL DEFAULT '[]',
    "trustLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "device_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_graph_nodes" (
    "id" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_graph_edges" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "countries" JSONB NOT NULL DEFAULT '[]',
    "currencies" JSONB NOT NULL DEFAULT '[]',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_policies" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "taxType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "appliesToCategory" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_policy_packs" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "taxRules" JSONB NOT NULL DEFAULT '{}',
    "complianceChecks" JSONB NOT NULL DEFAULT '[]',
    "identityVerification" JSONB NOT NULL DEFAULT '{}',
    "addressFormat" JSONB NOT NULL DEFAULT '{}',
    "currencyConfig" JSONB NOT NULL DEFAULT '{}',
    "paymentMethods" JSONB NOT NULL DEFAULT '[]',
    "localizations" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_policy_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cancellationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationLevel" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier" "ReputationTier" NOT NULL DEFAULT 'NEW',
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL DEFAULT '{}',
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "moderatorId" TEXT,
    "automatedReason" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_health_checks" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checkType" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_detections" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "serviceName" TEXT,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'LOW',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "anomaly_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region_configs" (
    "id" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" JSONB NOT NULL DEFAULT '[]',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "endpoints" JSONB NOT NULL DEFAULT '{}',
    "replicaOf" TEXT,
    "failoverTo" TEXT,
    "latencyBudgetMs" INTEGER NOT NULL DEFAULT 200,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expansion_simulations" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "simulatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiresCodeChange" BOOLEAN NOT NULL DEFAULT false,
    "requiresArchChange" BOOLEAN NOT NULL DEFAULT false,
    "policyPackReady" BOOLEAN NOT NULL DEFAULT false,
    "taxReady" BOOLEAN NOT NULL DEFAULT false,
    "paymentReady" BOOLEAN NOT NULL DEFAULT false,
    "localizationReady" BOOLEAN NOT NULL DEFAULT false,
    "complianceReady" BOOLEAN NOT NULL DEFAULT false,
    "overallReadiness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "report" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expansion_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_ownerId_status_idx" ON "properties"("ownerId", "status");

-- CreateIndex
CREATE INDEX "properties_categoryId_status_idx" ON "properties"("categoryId", "status");

-- CreateIndex
CREATE INDEX "properties_city_country_idx" ON "properties"("city", "country");

-- CreateIndex
CREATE INDEX "properties_deletedAt_idx" ON "properties"("deletedAt");

-- CreateIndex
CREATE INDEX "properties_status_type_idx" ON "properties"("status", "type");

-- CreateIndex
CREATE INDEX "properties_latitude_longitude_idx" ON "properties"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_ownerId_idx" ON "organizations"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "bookings_renterId_status_idx" ON "bookings"("renterId", "status");

-- CreateIndex
CREATE INDEX "bookings_ownerId_status_idx" ON "bookings"("ownerId", "status");

-- CreateIndex
CREATE INDEX "bookings_listingId_idx" ON "bookings"("listingId");

-- CreateIndex
CREATE INDEX "bookings_listingId_startDate_endDate_idx" ON "bookings"("listingId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "reviews_revieweeId_idx" ON "reviews"("revieweeId");

-- CreateIndex
CREATE INDEX "reviews_listingId_createdAt_idx" ON "reviews"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_reviewerId_type_key" ON "reviews"("bookingId", "reviewerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentIntentId_key" ON "payments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_status_idx" ON "payments"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refundId_key" ON "refunds"("refundId");

-- CreateIndex
CREATE INDEX "refunds_bookingId_idx" ON "refunds"("bookingId");

-- CreateIndex
CREATE INDEX "deposit_holds_bookingId_idx" ON "deposit_holds"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_transferId_key" ON "payouts"("transferId");

-- CreateIndex
CREATE INDEX "payouts_ownerId_status_idx" ON "payouts"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ledger_entries_bookingId_idx" ON "ledger_entries"("bookingId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_accountType_idx" ON "ledger_entries"("accountId", "accountType");

-- CreateIndex
CREATE INDEX "availability_propertyId_startDate_endDate_idx" ON "availability"("propertyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "availability_propertyId_status_idx" ON "availability"("propertyId", "status");

-- CreateIndex
CREATE INDEX "listing_contents_locale_idx" ON "listing_contents"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "listing_contents_listingId_locale_key" ON "listing_contents"("listingId", "locale");

-- CreateIndex
CREATE INDEX "listing_versions_listingId_createdAt_idx" ON "listing_versions"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_versions_listingId_version_key" ON "listing_versions"("listingId", "version");

-- CreateIndex
CREATE INDEX "category_attribute_definitions_categoryId_displayOrder_idx" ON "category_attribute_definitions"("categoryId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_attribute_definitions_categoryId_slug_key" ON "category_attribute_definitions"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "listing_attribute_values_attributeDefinitionId_value_idx" ON "listing_attribute_values"("attributeDefinitionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "listing_attribute_values_listingId_attributeDefinitionId_key" ON "listing_attribute_values"("listingId", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "inventory_units_listingId_isActive_idx" ON "inventory_units"("listingId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_listingId_sku_key" ON "inventory_units"("listingId", "sku");

-- CreateIndex
CREATE INDEX "availability_slots_listingId_startTime_endTime_idx" ON "availability_slots"("listingId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "availability_slots_inventoryUnitId_startTime_idx" ON "availability_slots"("inventoryUnitId", "startTime");

-- CreateIndex
CREATE INDEX "availability_slots_status_idx" ON "availability_slots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "availability_slots_listingId_inventoryUnitId_startTime_endT_key" ON "availability_slots"("listingId", "inventoryUnitId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rate_snapshots_bookingId_key" ON "fx_rate_snapshots"("bookingId");

-- CreateIndex
CREATE INDEX "fx_rate_snapshots_baseCurrency_targetCurrency_capturedAt_idx" ON "fx_rate_snapshots"("baseCurrency", "targetCurrency", "capturedAt");

-- CreateIndex
CREATE INDEX "booking_price_breakdowns_bookingId_sortOrder_idx" ON "booking_price_breakdowns"("bookingId", "sortOrder");

-- CreateIndex
CREATE INDEX "booking_state_history_bookingId_createdAt_idx" ON "booking_state_history"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_state_history_changedBy_idx" ON "booking_state_history"("changedBy");

-- CreateIndex
CREATE INDEX "booking_state_history_toStatus_createdAt_idx" ON "booking_state_history"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_active_idx" ON "device_tokens"("userId", "active");

-- CreateIndex
CREATE INDEX "identity_documents_userId_status_idx" ON "identity_documents"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_listings_userId_listingId_key" ON "favorite_listings"("userId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_policies_name_key" ON "cancellation_policies"("name");

-- CreateIndex
CREATE INDEX "condition_reports_bookingId_idx" ON "condition_reports"("bookingId");

-- CreateIndex
CREATE INDEX "condition_reports_propertyId_idx" ON "condition_reports"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_policies_policyNumber_key" ON "insurance_policies"("policyNumber");

-- CreateIndex
CREATE INDEX "insurance_policies_propertyId_idx" ON "insurance_policies"("propertyId");

-- CreateIndex
CREATE INDEX "insurance_policies_userId_idx" ON "insurance_policies"("userId");

-- CreateIndex
CREATE INDEX "insurance_policies_bookingId_idx" ON "insurance_policies"("bookingId");

-- CreateIndex
CREATE INDEX "insurance_policies_status_idx" ON "insurance_policies"("status");

-- CreateIndex
CREATE INDEX "insurance_policies_endDate_idx" ON "insurance_policies"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_claimNumber_key" ON "insurance_claims"("claimNumber");

-- CreateIndex
CREATE INDEX "insurance_claims_policyId_idx" ON "insurance_claims"("policyId");

-- CreateIndex
CREATE INDEX "insurance_claims_bookingId_idx" ON "insurance_claims"("bookingId");

-- CreateIndex
CREATE INDEX "insurance_claims_status_idx" ON "insurance_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE INDEX "email_templates_type_idx" ON "email_templates"("type");

-- CreateIndex
CREATE INDEX "email_templates_isActive_idx" ON "email_templates"("isActive");

-- CreateIndex
CREATE INDEX "conversations_bookingId_idx" ON "conversations"("bookingId");

-- CreateIndex
CREATE INDEX "conversations_listingId_idx" ON "conversations"("listingId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_receipts_messageId_userId_key" ON "message_read_receipts"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_conditionReportId_key" ON "disputes"("conditionReportId");

-- CreateIndex
CREATE INDEX "disputes_bookingId_idx" ON "disputes"("bookingId");

-- CreateIndex
CREATE INDEX "disputes_status_priority_idx" ON "disputes"("status", "priority");

-- CreateIndex
CREATE INDEX "disputes_initiatorId_idx" ON "disputes"("initiatorId");

-- CreateIndex
CREATE INDEX "disputes_defendantId_idx" ON "disputes"("defendantId");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_resolutions_disputeId_key" ON "dispute_resolutions"("disputeId");

-- CreateIndex
CREATE INDEX "tax_rules_country_state_isActive_idx" ON "tax_rules"("country", "state", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_country_state_city_type_key" ON "tax_rules"("country", "state", "city", "type");

-- CreateIndex
CREATE INDEX "policy_rules_type_country_status_idx" ON "policy_rules"("type", "country", "status");

-- CreateIndex
CREATE INDEX "policy_rules_effectiveFrom_effectiveTo_idx" ON "policy_rules"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "policy_rules_type_country_state_city_status_idx" ON "policy_rules"("type", "country", "state", "city", "status");

-- CreateIndex
CREATE INDEX "policy_audit_log_policyType_createdAt_idx" ON "policy_audit_log"("policyType", "createdAt");

-- CreateIndex
CREATE INDEX "policy_audit_log_entityType_entityId_idx" ON "policy_audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "policy_audit_log_userId_createdAt_idx" ON "policy_audit_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "policy_audit_log_requestId_idx" ON "policy_audit_log"("requestId");

-- CreateIndex
CREATE INDEX "pricing_rules_listingId_isActive_idx" ON "pricing_rules"("listingId", "isActive");

-- CreateIndex
CREATE INDEX "pricing_rules_categoryId_isActive_idx" ON "pricing_rules"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "pricing_rules_country_type_isActive_idx" ON "pricing_rules"("country", "type", "isActive");

-- CreateIndex
CREATE INDEX "trust_scores_scoreType_tier_idx" ON "trust_scores"("scoreType", "tier");

-- CreateIndex
CREATE INDEX "trust_scores_userId_idx" ON "trust_scores"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trust_scores_userId_scoreType_key" ON "trust_scores"("userId", "scoreType");

-- CreateIndex
CREATE INDEX "compliance_records_entityType_entityId_idx" ON "compliance_records"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "compliance_records_country_checkType_status_idx" ON "compliance_records"("country", "checkType", "status");

-- CreateIndex
CREATE INDEX "compliance_records_expiresAt_idx" ON "compliance_records"("expiresAt");

-- CreateIndex
CREATE INDEX "platform_metrics_name_periodStart_idx" ON "platform_metrics"("name", "periodStart");

-- CreateIndex
CREATE INDEX "platform_metrics_name_period_periodStart_idx" ON "platform_metrics"("name", "period", "periodStart");

-- CreateIndex
CREATE INDEX "escrow_transactions_bookingId_status_idx" ON "escrow_transactions"("bookingId", "status");

-- CreateIndex
CREATE INDEX "escrow_transactions_status_holdUntil_idx" ON "escrow_transactions"("status", "holdUntil");

-- CreateIndex
CREATE INDEX "dispute_escalations_disputeId_createdAt_idx" ON "dispute_escalations"("disputeId", "createdAt");

-- CreateIndex
CREATE INDEX "dispute_escalations_assignedTo_toLevel_idx" ON "dispute_escalations"("assignedTo", "toLevel");

-- CreateIndex
CREATE INDEX "marketplace_health_metrics_country_date_idx" ON "marketplace_health_metrics"("country", "date");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_health_metrics_country_region_date_key" ON "marketplace_health_metrics"("country", "region", "date");

-- CreateIndex
CREATE INDEX "host_activation_campaigns_country_status_idx" ON "host_activation_campaigns"("country", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_sessionId_key" ON "ai_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_createdAt_idx" ON "ai_conversations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_conversations_agentType_status_idx" ON "ai_conversations"("agentType", "status");

-- CreateIndex
CREATE INDEX "ai_conversation_turns_conversationId_createdAt_idx" ON "ai_conversation_turns"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "demand_forecasts_country_forecastDate_idx" ON "demand_forecasts"("country", "forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "demand_forecasts_country_region_category_forecastDate_horiz_key" ON "demand_forecasts"("country", "region", "category", "forecastDate", "horizon");

-- CreateIndex
CREATE INDEX "demand_signals_country_signalType_date_idx" ON "demand_signals"("country", "signalType", "date");

-- CreateIndex
CREATE UNIQUE INDEX "market_opportunities_country_key" ON "market_opportunities"("country");

-- CreateIndex
CREATE INDEX "market_opportunities_overallScore_idx" ON "market_opportunities"("overallScore");

-- CreateIndex
CREATE INDEX "search_events_userId_createdAt_idx" ON "search_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "search_events_searchType_country_idx" ON "search_events"("searchType", "country");

-- CreateIndex
CREATE UNIQUE INDEX "user_search_profiles_userId_key" ON "user_search_profiles"("userId");

-- CreateIndex
CREATE INDEX "pricing_recommendations_listingId_date_idx" ON "pricing_recommendations"("listingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_recommendations_listingId_date_key" ON "pricing_recommendations"("listingId", "date");

-- CreateIndex
CREATE INDEX "fraud_signals_entityType_entityId_idx" ON "fraud_signals"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "fraud_signals_riskScore_idx" ON "fraud_signals"("riskScore");

-- CreateIndex
CREATE INDEX "fraud_signals_signalType_createdAt_idx" ON "fraud_signals"("signalType", "createdAt");

-- CreateIndex
CREATE INDEX "device_fingerprints_fingerprint_idx" ON "device_fingerprints"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "device_fingerprints_userId_fingerprint_key" ON "device_fingerprints"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "inventory_graph_nodes_nodeType_country_idx" ON "inventory_graph_nodes"("nodeType", "country");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_graph_nodes_nodeType_entityId_key" ON "inventory_graph_nodes"("nodeType", "entityId");

-- CreateIndex
CREATE INDEX "inventory_graph_edges_fromNodeId_edgeType_idx" ON "inventory_graph_edges"("fromNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "inventory_graph_edges_toNodeId_edgeType_idx" ON "inventory_graph_edges"("toNodeId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_graph_edges_fromNodeId_toNodeId_edgeType_key" ON "inventory_graph_edges"("fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "payment_providers_name_key" ON "payment_providers"("name");

-- CreateIndex
CREATE INDEX "payment_providers_isActive_priority_idx" ON "payment_providers"("isActive", "priority");

-- CreateIndex
CREATE INDEX "tax_policies_country_state_isActive_idx" ON "tax_policies"("country", "state", "isActive");

-- CreateIndex
CREATE INDEX "tax_policies_effectiveFrom_effectiveTo_idx" ON "tax_policies"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "country_policy_packs_country_key" ON "country_policy_packs"("country");

-- CreateIndex
CREATE INDEX "reputation_scores_tier_overallScore_idx" ON "reputation_scores"("tier", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_scores_userId_key" ON "reputation_scores"("userId");

-- CreateIndex
CREATE INDEX "moderation_actions_entityType_entityId_idx" ON "moderation_actions"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "moderation_actions_status_createdAt_idx" ON "moderation_actions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_health_checks_serviceName_checkedAt_idx" ON "service_health_checks"("serviceName", "checkedAt");

-- CreateIndex
CREATE INDEX "service_health_checks_status_idx" ON "service_health_checks"("status");

-- CreateIndex
CREATE INDEX "anomaly_detections_metricName_detectedAt_idx" ON "anomaly_detections"("metricName", "detectedAt");

-- CreateIndex
CREATE INDEX "anomaly_detections_severity_acknowledged_idx" ON "anomaly_detections"("severity", "acknowledged");

-- CreateIndex
CREATE UNIQUE INDEX "region_configs_regionCode_key" ON "region_configs"("regionCode");

-- CreateIndex
CREATE INDEX "expansion_simulations_country_idx" ON "expansion_simulations"("country");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_cancellationPolicyId_fkey" FOREIGN KEY ("cancellationPolicyId") REFERENCES "cancellation_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_fkey" FOREIGN KEY ("renterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingOwner_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_holds" ADD CONSTRAINT "deposit_holds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_contents" ADD CONSTRAINT "listing_contents_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_versions" ADD CONSTRAINT "listing_versions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_versions" ADD CONSTRAINT "listing_versions_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute_definitions" ADD CONSTRAINT "category_attribute_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_attribute_values" ADD CONSTRAINT "listing_attribute_values_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_attribute_values" ADD CONSTRAINT "listing_attribute_values_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "category_attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_rate_snapshots" ADD CONSTRAINT "fx_rate_snapshots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_price_breakdowns" ADD CONSTRAINT "booking_price_breakdowns_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_state_history" ADD CONSTRAINT "booking_state_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_listings" ADD CONSTRAINT "favorite_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_listings" ADD CONSTRAINT "favorite_listings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_conditionReportId_fkey" FOREIGN KEY ("conditionReportId") REFERENCES "condition_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_defendantId_fkey" FOREIGN KEY ("defendantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_responses" ADD CONSTRAINT "dispute_responses_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_responses" ADD CONSTRAINT "dispute_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_timeline_events" ADD CONSTRAINT "dispute_timeline_events_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_resolutions" ADD CONSTRAINT "dispute_resolutions_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "policy_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_audit_log" ADD CONSTRAINT "policy_audit_log_policyRuleId_fkey" FOREIGN KEY ("policyRuleId") REFERENCES "policy_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_scores" ADD CONSTRAINT "trust_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_escalations" ADD CONSTRAINT "dispute_escalations_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_turns" ADD CONSTRAINT "ai_conversation_turns_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_search_profiles" ADD CONSTRAINT "user_search_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_recommendations" ADD CONSTRAINT "pricing_recommendations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_graph_edges" ADD CONSTRAINT "inventory_graph_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "inventory_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_graph_edges" ADD CONSTRAINT "inventory_graph_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "inventory_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_scores" ADD CONSTRAINT "reputation_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

