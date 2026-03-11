# Global Policy & Rules Engine Architecture Specification

**Version:** 1.0.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Author:** Principal Architect  
**Date:** 2026-03-02  
**System:** GharBatai Rentals — Multi-Country Rental Marketplace  
**Classification:** Internal — Architecture Board & Engineering Leadership  

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Core Architectural Principles](#2-core-architectural-principles)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Policy Engine Design](#4-policy-engine-design)
5. [Context Resolution Layer](#5-context-resolution-layer)
6. [Tax Engine Architecture](#6-tax-engine-architecture)
7. [Currency Architecture](#7-currency-architecture)
8. [Localization Architecture](#8-localization-architecture)
9. [Booking Rules Engine](#9-booking-rules-engine)
10. [Compliance Module](#10-compliance-module)
11. [Versioning Strategy](#11-versioning-strategy)
12. [Audit & Explainability](#12-audit--explainability)
13. [Extensibility Simulation](#13-extensibility-simulation)
14. [Performance Considerations](#14-performance-considerations)
15. [Failure Handling](#15-failure-handling)
16. [Security Considerations](#16-security-considerations)
17. [Implementation Options](#17-implementation-options)
18. [Deliverables & Data Models](#18-deliverables--data-models)

---

## 1. Executive Overview

### 1.1 Problem Statement

GharBatai Rentals currently operates with Nepal-centric logic embedded across domain services. The `TaxCalculationService` contains a hardcoded `Map<string, TaxRate[]>` with static entries for US, UK, DE, FR, CA, AU, and NP. The `nepal.config.ts` shared-types file hardcodes `SUPPORTED_CURRENCIES = ['NPR', 'USD', 'INR']` and `SUPPORTED_LOCALES = ['en', 'ne']`. Fee percentages are stored in environment variables (`fees.platformFeePercent`). Cancellation policies live in a fixed DB table with no jurisdiction scoping.

This architecture **fails at scale** because:

| Problem | Current State | Impact |
|---------|--------------|--------|
| Tax calculation | Hardcoded `Map` in `TaxCalculationService` | Adding a country requires code deployment |
| Currency support | `SUPPORTED_CURRENCIES` constant in shared-types | Adding INR→BDT requires package rebuild + deploy |
| Locale support | `SUPPORTED_LOCALES` constant with 2 entries | Adding Hindi requires code change in multiple packages |
| Fee rules | Single `platformFeePercent` env var | Cannot vary fees by country, category, or booking value |
| Cancellation rules | Single `CancellationPolicy` model with no jurisdiction | Same policy for Nepal and US violates local consumer protection laws |
| Booking constraints | `minStayNights`/`maxStayNights` on Listing model | No ability to enforce country-level seasonal restrictions |
| Compliance | None | No mechanism for identity requirements, data retention, payment regulation per jurisdiction |

### 1.2 Why Metadata + Policy Engine Is Mandatory

Operating a rental marketplace in multiple jurisdictions involves:

- **Tax law**: Nepal (13% VAT), India (18% GST + state-level CGST/SGST), US (varies by state/city/county, lodging taxes), EU (VAT with reverse-charge mechanisms)
- **Consumer protection**: EU allows 14-day withdrawal for distance contracts; India has strict refund timelines under Consumer Protection Act 2019
- **Payment regulations**: Nepal Rastra Bank mandates NPR settlement; India RBI restricts cross-border payment flows; PSD2 in Europe requires SCA
- **Identity requirements**: Nepal requires citizenship certificate for owners; India requires PAN/Aadhaar; EU requires GDPR-compliant identity verification
- **Data residency**: India's DPDPA 2023 requires certain data to remain in-country; EU GDPR restricts cross-border data transfer

Embedding any of this in `if/else` blocks creates:
1. **Deployment risk**: Tax rate changes require full CI/CD cycle
2. **Regression risk**: Modifying Nepal VAT can break US sales tax
3. **Audit failure**: Regulators cannot inspect a configuration; they need versioned, timestamped rule records
4. **Velocity drag**: Launching in India blocks on engineering availability, not business readiness

### 1.3 Solution: Configuration-Driven Policy Engine

Every country-specific, region-specific, and time-variant business rule is expressed as **data**:

- Stored in versioned database rows
- Evaluated at runtime by a generic rule engine
- Audited on every decision
- Modifiable via admin UI with approval workflows
- Backward-compatible via effective-date ranges

**Adding a new country = database inserts. Zero code changes in the core domain layer.**

---

## 2. Core Architectural Principles

### 2.1 The Seven Laws

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Domain layer must not know about countries** | No `country` field in service method signatures. Services receive a `PolicyContext` and delegate to the policy engine. |
| 2 | **No `if (country === "X")` logic allowed** | Static analysis lint rule (`no-country-conditional`). PR reviews enforce this. |
| 3 | **All country-specific logic lives in policy modules** | Policies are registered in the `PolicyRegistry`. Domain services depend on `PolicyEngine`, not on country knowledge. |
| 4 | **Policy resolution is runtime-based** | The `ContextResolver` builds a `PolicyContext` from the request, listing, user profile, and geo data. The `PolicyEngine` evaluates matching rules. |
| 5 | **Rules must be versioned** | Every `PolicyRule` has `version`, `effectiveFrom`, `effectiveTo`. Historical decisions are replayable. |
| 6 | **Rules must be testable independently** | Each rule can be evaluated in isolation with a mocked `PolicyContext`. The rule evaluator is a pure function. |
| 7 | **Every policy decision must be logged** | The `PolicyAuditService` records: input context, matched rules, evaluation trace, final decision, timestamp. |

### 2.2 Architectural Constraints

```
┌─────────────────────────────────────────────────────────────────┐
│                     FORBIDDEN PATTERNS                          │
├─────────────────────────────────────────────────────────────────┤
│ ✗ import { NEPAL_VAT } from './constants'                      │
│ ✗ if (listing.country === 'NP') tax = subtotal * 0.13          │
│ ✗ const fee = country === 'IN' ? 0.10 : 0.15                  │
│ ✗ switch (jurisdiction) { case 'US': ... case 'EU': ... }      │
│ ✗ const minStay = region === 'EU' ? 2 : 1                     │
│ ✗ SUPPORTED_CURRENCIES = ['NPR', 'USD', 'INR'] // hardcoded   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     REQUIRED PATTERNS                           │
├─────────────────────────────────────────────────────────────────┤
│ ✓ const tax = await policyEngine.evaluate('TAX', context)      │
│ ✓ const fee = await policyEngine.evaluate('FEE', context)      │
│ ✓ const rules = await policyEngine.evaluate('BOOKING', context)│
│ ✓ const currencies = await configService.getSupportedCurrencies│
│ ✓ const locales = await configService.getSupportedLocales()    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Dependency Flow

```
Domain Services → PolicyEngine → PolicyRegistry → RuleStore (DB)
                                                 ↓
                                         PolicyAuditService → AuditLog (DB)
```

Domain services **NEVER** access `RuleStore` directly. The `PolicyEngine` is the sole mediator.

---

## 3. High-Level Architecture

### 3.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                               │
│  │   Web    │  │  Mobile  │  │   API    │                               │
│  │  (React) │  │  (RN)   │  │ Consumers │                               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                               │
└───────┼──────────────┼─────────────┼─────────────────────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY / NestJS                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ LocaleInterceptor│  │   AuthGuard     │  │  RateLimiter    │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                     │                    │
│           ▼                    ▼                     ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                     CONTEXT RESOLVER                              │    │
│  │  Builds PolicyContext from: request headers, user profile,        │    │
│  │  listing location, payment country, workspace config, geo lookup  │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      POLICY ENGINE                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │    │
│  │  │ Rule Matcher │  │ Condition   │  │  Action     │              │    │
│  │  │             │  │ Evaluator   │  │  Executor   │              │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │    │
│  │         │                │                │                      │    │
│  │         ▼                ▼                ▼                      │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │                POLICY REGISTRY                           │    │    │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │    │    │
│  │  │  │  Tax   │ │  Fee   │ │Booking │ │Compliance│          │    │    │
│  │  │  │ Policy │ │ Policy │ │ Policy │ │ Policy  │          │    │    │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘           │    │    │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │    │    │
│  │  │  │Cancel. │ │Currency│ │Identity│ │Pricing │          │    │    │
│  │  │  │ Policy │ │ Policy │ │ Policy │ │ Policy │          │    │    │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘           │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│          ┌───────────────────┼───────────────────┐                      │
│          ▼                   ▼                   ▼                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │ DOMAIN SVCS  │   │  AUDIT LOG   │   │ CONFIG SVC   │                │
│  │              │   │  SERVICE     │   │              │                │
│  │ BookingSvc   │   │              │   │ Currencies   │                │
│  │ PaymentSvc   │   │ Decisions    │   │ Locales      │                │
│  │ ListingSvc   │   │ Rule traces  │   │ Timezones    │                │
│  │ TaxSvc       │   │ Context logs │   │ Countries    │                │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                │
│         │                  │                   │                        │
└─────────┼──────────────────┼───────────────────┼────────────────────────┘
          ▼                  ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  PostgreSQL   │  │    Redis     │  │  Object      │                   │
│  │              │  │   (Cache)    │  │  Storage     │                   │
│  │ policy_rules │  │              │  │              │                   │
│  │ tax_rules    │  │ rule_cache   │  │ audit_exports│                   │
│  │ audit_logs   │  │ fx_cache     │  │              │                   │
│  │ config_store │  │ config_cache │  │              │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Data Flow

```
1. HTTP Request arrives
   │
2. LocaleInterceptor extracts Accept-Language → request.locale
   │
3. AuthGuard authenticates user → request.user
   │
4. Controller receives request
   │
5. ContextResolver.resolve(request, listing?) builds PolicyContext:
   │  {
   │    locale: 'ne',
   │    country: 'NP',
   │    state: null,
   │    city: 'Kathmandu',
   │    currency: 'NPR',
   │    timezone: 'Asia/Kathmandu',
   │    userId: 'user_abc',
   │    userRole: 'RENTER',
   │    listingCategory: 'SPACES',
   │    bookingValue: 15000,
   │    bookingDuration: 7,
   │    requestTimestamp: '2026-03-02T10:30:00+05:45',
   │    evaluationDate: '2026-03-02'
   │  }
   │
6. Domain Service calls PolicyEngine.evaluate(policyType, context)
   │
7. PolicyEngine:
   │  a. Queries PolicyRegistry for matching rules
   │  b. Filters by jurisdiction scope (country → state → city)
   │  c. Filters by effective date range
   │  d. Sorts by priority (lower number = higher priority)
   │  e. Evaluates conditions (JSON predicate logic)
   │  f. Executes matched actions
   │  g. Returns PolicyDecision
   │
8. PolicyAuditService.log(context, matchedRules, decision)
   │
9. Domain Service uses PolicyDecision to proceed
   │
10. Response returned to client
```

---

## 4. Policy Engine Design

### 4.1 Policy Types

| Policy Type | Purpose | Example |
|-------------|---------|---------|
| `TAX` | Calculate applicable taxes | Nepal 13% VAT, California 7.25% sales tax + 14% lodging tax |
| `FEE` | Platform and service fees | 12% platform fee in Nepal, 10% in India, tiered for high-value bookings |
| `PRICING` | Dynamic pricing rules | Weekend +20%, holiday +50%, seasonal multipliers |
| `CANCELLATION` | Cancellation and refund rules | EU 14-day cooling-off, strict/moderate/flexible per jurisdiction |
| `BOOKING_CONSTRAINT` | Booking eligibility rules | Min 2 nights for spaces in EU, max 28 days short-term in NYC |
| `COMPLIANCE` | Regulatory compliance | GDPR consent, PAN card for India payments >₹50k |
| `CURRENCY` | Currency formatting and conversion | Display rules, rounding, minor-unit precision |
| `IDENTITY` | Identity verification requirements | Citizenship cert for Nepal owners, Aadhaar for India, EU eIDAS |

### 4.2 Policy Rule Structure

Every policy rule follows this canonical structure:

```typescript
interface PolicyRule {
  // ── Identity ──
  id: string;                    // Unique CUID
  type: PolicyType;              // TAX | FEE | PRICING | CANCELLATION | ...
  name: string;                  // Human-readable: "Nepal VAT 13%"
  description: string;           // Detailed explanation for audit

  // ── Jurisdiction Scope ──
  country: string;               // ISO 3166-1 alpha-2: "NP", "IN", "US", "*"
  state: string | null;          // State/province code: "CA", "BG-3", null
  city: string | null;           // City name: "Kathmandu", "San Francisco", null
  jurisdictionPriority: number;  // City=3, State=2, Country=1, Global=0

  // ── Versioning ──
  version: number;               // Monotonically increasing
  effectiveFrom: DateTime;       // When this rule becomes active
  effectiveTo: DateTime | null;  // When this rule expires (null = indefinite)
  supersedes: string | null;     // ID of the rule this replaces

  // ── Evaluation ──
  priority: number;              // Lower = higher priority. Ties broken by specificity
  conditions: RuleCondition[];   // All must be true for rule to match
  actions: RuleAction[];         // Outputs when rule matches

  // ── Governance ──
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdBy: string;             // User ID of creator
  approvedBy: string | null;     // User ID of approver
  approvedAt: DateTime | null;
  tags: string[];                // ['vat', 'nepal', 'standard-rate']

  // ── Metadata ──
  metadata: Record<string, any>; // Extensible key-value pairs
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### 4.3 Condition Model

Conditions use a JSON-based predicate language that the rule evaluator interprets:

```typescript
interface RuleCondition {
  field: string;       // Dot-path into PolicyContext: "country", "listingCategory", "bookingValue"
  operator: ConditionOperator;
  value: any;          // Comparison value
  negate?: boolean;    // Invert the result
}

type ConditionOperator =
  | 'eq'         // Exact equality
  | 'neq'        // Not equal
  | 'gt'         // Greater than
  | 'gte'        // Greater or equal
  | 'lt'         // Less than
  | 'lte'        // Less or equal
  | 'in'         // Value is in array
  | 'nin'        // Value is not in array
  | 'contains'   // String contains
  | 'startsWith' // String starts with
  | 'regex'      // Regex match
  | 'between'    // [min, max] inclusive
  | 'exists'     // Field is present and non-null
  | 'dayOfWeek'  // Day-of-week check (for weekend pricing)
  | 'dateRange'  // Date falls within a range
  | 'always';    // No condition — always matches
```

### 4.4 Action Model

```typescript
interface RuleAction {
  type: ActionType;
  params: Record<string, any>;
}

type ActionType =
  | 'SET_RATE'           // { rate: 13.0, basis: 'PERCENTAGE' }
  | 'SET_FIXED_AMOUNT'   // { amount: 500, currency: 'NPR' }
  | 'SET_MULTIPLIER'     // { multiplier: 1.2 }
  | 'SET_MIN_MAX'        // { min: 2, max: 28 }
  | 'SET_BOOLEAN'        // { value: true }
  | 'SET_ENUM'           // { value: 'STRICT' }
  | 'SET_OBJECT'         // { value: { ... } } — arbitrary structured data
  | 'COMPOUND'           // { base: 'previous_tax_lines', rate: 1.5 } — tax on tax
  | 'BLOCK'              // { reason: 'Regulatory restriction' }
  | 'REQUIRE_DOCUMENT';  // { documentType: 'PAN_CARD', threshold: 50000 }
```

### 4.5 Example Rules as JSON

#### Example 1: Nepal VAT 13%

```json
{
  "id": "rule_np_vat_13",
  "type": "TAX",
  "name": "Nepal Standard VAT",
  "description": "Nepal Value Added Tax at 13% on all rental transactions per VAT Act 2052",
  "country": "NP",
  "state": null,
  "city": null,
  "jurisdictionPriority": 1,
  "version": 1,
  "effectiveFrom": "2024-01-01T00:00:00Z",
  "effectiveTo": null,
  "supersedes": null,
  "priority": 100,
  "conditions": [
    { "field": "country", "operator": "eq", "value": "NP" }
  ],
  "actions": [
    {
      "type": "SET_RATE",
      "params": {
        "taxType": "VAT",
        "name": "Nepal VAT",
        "rate": 13.0,
        "basis": "PERCENTAGE",
        "jurisdiction": "Nepal",
        "appliesTo": ["ALL"]
      }
    }
  ],
  "status": "ACTIVE",
  "tags": ["vat", "nepal", "standard-rate"]
}
```

#### Example 2: India Multi-Tier GST

```json
{
  "id": "rule_in_gst_18",
  "type": "TAX",
  "name": "India GST 18% (Standard Rate)",
  "description": "Goods and Services Tax at 18% for standard rental services in India",
  "country": "IN",
  "state": null,
  "city": null,
  "jurisdictionPriority": 1,
  "version": 1,
  "effectiveFrom": "2024-07-01T00:00:00Z",
  "effectiveTo": null,
  "priority": 100,
  "conditions": [
    { "field": "country", "operator": "eq", "value": "IN" },
    { "field": "bookingValue", "operator": "lte", "value": 100000 }
  ],
  "actions": [
    {
      "type": "SET_RATE",
      "params": {
        "taxType": "GST",
        "name": "CGST",
        "rate": 9.0,
        "basis": "PERCENTAGE",
        "jurisdiction": "Central"
      }
    },
    {
      "type": "SET_RATE",
      "params": {
        "taxType": "GST",
        "name": "SGST",
        "rate": 9.0,
        "basis": "PERCENTAGE",
        "jurisdiction": "State"
      }
    }
  ],
  "status": "ACTIVE",
  "tags": ["gst", "india", "standard-rate"]
}
```

#### Example 3: Weekend Pricing Rule

```json
{
  "id": "rule_weekend_pricing_np",
  "type": "PRICING",
  "name": "Nepal Weekend Surcharge",
  "description": "20% price increase for bookings starting on Friday or Saturday in Nepal",
  "country": "NP",
  "state": null,
  "city": null,
  "jurisdictionPriority": 1,
  "version": 1,
  "effectiveFrom": "2025-01-01T00:00:00Z",
  "effectiveTo": null,
  "priority": 200,
  "conditions": [
    { "field": "country", "operator": "eq", "value": "NP" },
    { "field": "startDate", "operator": "dayOfWeek", "value": [5, 6] },
    { "field": "listingCategory", "operator": "in", "value": ["SPACES", "EVENT_VENUES"] }
  ],
  "actions": [
    {
      "type": "SET_MULTIPLIER",
      "params": { "multiplier": 1.20, "label": "Weekend surcharge" }
    }
  ],
  "status": "ACTIVE",
  "tags": ["pricing", "weekend", "nepal"]
}
```

#### Example 4: NYC Short-Term Rental Restriction

```json
{
  "id": "rule_us_ny_nyc_short_term",
  "type": "BOOKING_CONSTRAINT",
  "name": "NYC Short-Term Rental Restriction",
  "description": "NYC Local Law 18 restricts short-term rentals (<30 days) without host present",
  "country": "US",
  "state": "NY",
  "city": "New York",
  "jurisdictionPriority": 3,
  "version": 1,
  "effectiveFrom": "2023-09-05T00:00:00Z",
  "effectiveTo": null,
  "priority": 10,
  "conditions": [
    { "field": "country", "operator": "eq", "value": "US" },
    { "field": "state", "operator": "eq", "value": "NY" },
    { "field": "city", "operator": "eq", "value": "New York" },
    { "field": "bookingDuration", "operator": "lt", "value": 30 },
    { "field": "listingCategory", "operator": "eq", "value": "SPACES" },
    { "field": "hostPresent", "operator": "eq", "value": false }
  ],
  "actions": [
    {
      "type": "BLOCK",
      "params": {
        "reason": "NYC Local Law 18 prohibits short-term rentals (<30 days) in Class A dwellings without host present",
        "referenceUrl": "https://www.nyc.gov/site/specialenforcement/registration/registration.page"
      }
    }
  ],
  "status": "ACTIVE",
  "tags": ["compliance", "us", "new-york", "short-term-restriction"]
}
```

#### Example 5: Tiered Platform Fee

```json
{
  "id": "rule_fee_tiered_np",
  "type": "FEE",
  "name": "Nepal Tiered Platform Fee",
  "description": "Platform fee decreasing with booking value: 15% <5k, 12% 5k-50k, 10% >50k NPR",
  "country": "NP",
  "state": null,
  "city": null,
  "jurisdictionPriority": 1,
  "version": 1,
  "effectiveFrom": "2025-06-01T00:00:00Z",
  "effectiveTo": null,
  "priority": 100,
  "conditions": [
    { "field": "country", "operator": "eq", "value": "NP" },
    { "field": "bookingValue", "operator": "lt", "value": 5000 }
  ],
  "actions": [
    {
      "type": "SET_RATE",
      "params": {
        "feeType": "PLATFORM_FEE",
        "name": "Platform Service Fee",
        "rate": 15.0,
        "basis": "PERCENTAGE"
      }
    }
  ],
  "status": "ACTIVE",
  "tags": ["fee", "platform", "nepal", "tier-1"]
}
```

---

## 5. Context Resolution Layer

### 5.1 PolicyContext Structure

```typescript
interface PolicyContext {
  // ── Locale / Region ──
  locale: string;             // Resolved language: 'en', 'ne', 'hi'
  country: string;            // ISO 3166-1 alpha-2
  state: string | null;       // State/province code
  city: string | null;        // City name
  timezone: string;           // IANA timezone: 'Asia/Kathmandu'
  currency: string;           // ISO 4217: 'NPR'

  // ── User ──
  userId: string | null;
  userRole: string;           // 'RENTER' | 'OWNER' | 'ADMIN' | 'GUEST'
  userCountry: string | null; // User's registered country

  // ── Listing ──
  listingId: string | null;
  listingCategory: string | null;
  listingCountry: string | null;
  listingState: string | null;
  listingCity: string | null;

  // ── Booking ──
  bookingValue: number | null;
  bookingDuration: number | null;
  bookingCurrency: string | null;
  startDate: string | null;   // ISO 8601
  endDate: string | null;
  guestCount: number | null;
  hostPresent: boolean | null;

  // ── Request ──
  requestTimestamp: string;   // ISO 8601
  evaluationDate: string;     // Date-only for effective-date matching
  ipCountry: string | null;   // GeoIP-resolved country
  platform: string;           // 'web' | 'mobile' | 'api'

  // ── Workspace / Tenant ──
  tenantId: string | null;    // For multi-tenant SaaS deployments
  workspaceConfig: Record<string, any>;
}
```

### 5.2 Resolution Priority & Override Order

The context resolver follows a **Most-Specific-Wins** strategy:

```
Priority (highest to lowest):
─────────────────────────────
1. Explicit request parameter   → ?country=IN&currency=INR
2. Listing location             → listing.country, listing.state, listing.city
3. User profile preference      → user.preferredLocale, user.preferredCurrency
4. Workspace configuration      → workspace.defaultCountry, workspace.defaultCurrency
5. Accept-Language header        → en-US → country=US, locale=en
6. GeoIP lookup                  → IP → country=NP
7. System default               → country=NP, currency=NPR, locale=en
```

For **tax calculation**, the jurisdiction is ALWAYS derived from the listing's physical location (not the user's location). Tax is a property of where the item exists, not who rents it.

For **display formatting** (currency symbol, date format), the user's locale preference takes precedence.

### 5.3 Override Mechanism

```
User sees: "Display prices in USD" toggle → sets user.preferredCurrency = 'USD'
Tax is still calculated in listing.currency (NPR)
Display price = FxService.convert(totalNPR, 'NPR', 'USD')
Tax jurisdiction = listing.country (NP) — always

This is NOT an override of tax rules. It's a display preference only.
```

---

## 6. Tax Engine Architecture

### 6.1 Design Principles

| Principle | Implementation |
|-----------|---------------|
| Tax is NEVER calculated in domain services | `BookingService.calculatePrice()` calls `TaxPolicyEngine.calculate(context)` |
| Tax rules live in the database | `policy_rules` table with `type = 'TAX'` |
| Compound taxes supported | Action type `COMPOUND` allows tax-on-tax (e.g., Canadian PST on GST in some provinces) |
| Historical replay | Bookings store `taxRuleSnapshot` — the exact rule version applied at creation time |
| Category-specific rates | Conditions can match `listingCategory` — lodging taxes only apply to SPACES |
| Time-bound rates | `effectiveFrom`/`effectiveTo` ensure rate changes don't affect past bookings |

### 6.2 Tax Types Supported

| Tax Type | Regions | How Stored |
|----------|---------|-----------|
| VAT (Value Added Tax) | Nepal, EU, UK | Single action: `SET_RATE { taxType: 'VAT', rate: 13.0 }` |
| GST (Goods & Services Tax) | India, Australia, Canada | Split: CGST + SGST (India), single GST (AU) |
| Sales Tax | United States | Multi-level: state + county + city |
| Withholding Tax | Various | Action: `SET_RATE { taxType: 'WITHHOLDING', rate: 1.5 }` |
| Tourism/Lodging Tax | US cities, EU cities | Condition: `listingCategory in ['SPACES', 'EVENT_VENUES']` |
| Service Charge | Singapore, Middle East | Action: `SET_RATE { taxType: 'SERVICE_CHARGE', rate: 10.0 }` |
| Compound Tax | Canada (some provinces) | Action: `COMPOUND { base: 'subtotal_plus_gst', rate: 7.0 }` |

### 6.3 Tax Calculation Flow

```
BookingService.create(bookingData)
  │
  ├──▶ ContextResolver.resolve(request, listing)
  │    → PolicyContext { country: 'NP', category: 'SPACES', value: 15000 }
  │
  ├──▶ TaxPolicyEngine.calculate(context, subtotal)
  │    │
  │    ├──▶ PolicyEngine.evaluate('TAX', context)
  │    │    │
  │    │    ├── Query: SELECT * FROM policy_rules
  │    │    │   WHERE type = 'TAX'
  │    │    │     AND status = 'ACTIVE'
  │    │    │     AND (country = 'NP' OR country = '*')
  │    │    │     AND effective_from <= NOW()
  │    │    │     AND (effective_to IS NULL OR effective_to > NOW())
  │    │    │   ORDER BY jurisdiction_priority DESC, priority ASC
  │    │    │
  │    │    ├── Matched: rule_np_vat_13 (Nepal VAT 13%)
  │    │    │
  │    │    ├── Evaluate conditions:
  │    │    │   ✓ context.country == 'NP'
  │    │    │
  │    │    └── Execute actions:
  │    │        → TaxLine { type: 'VAT', name: 'Nepal VAT', rate: 13%, amount: 1950 }
  │    │
  │    └── Return TaxBreakdown:
  │        { subtotal: 15000, taxLines: [...], totalTax: 1950, total: 16950 }
  │
  ├──▶ PolicyAuditService.log({
  │      context, matchedRules: ['rule_np_vat_13'],
  │      decision: { totalTax: 1950 }, timestamp: NOW
  │    })
  │
  └──▶ Store booking with taxRuleSnapshot: {
         ruleId: 'rule_np_vat_13', version: 1,
         rate: 13.0, amount: 1950
       }
```

### 6.4 Historical Tax Replay

When a booking is created, the applied tax rules are **snapshotted** into the booking's `metadata` field:

```json
{
  "taxSnapshot": {
    "evaluatedAt": "2026-03-02T10:30:00Z",
    "rules": [
      {
        "ruleId": "rule_np_vat_13",
        "version": 1,
        "rate": 13.0,
        "amount": 1950,
        "jurisdiction": "Nepal"
      }
    ],
    "contextHash": "sha256:abc123..."
  }
}
```

If Nepal changes VAT from 13% to 15% in 2027:
- **New bookings** → new rule version (`version: 2`, `effectiveFrom: 2027-04-01`)
- **Existing bookings** → retain original snapshot. Refund calculations use the original 13% rate.
- **Audit queries** → "Show all bookings created under rule_np_vat_13 v1" is a simple DB query.

---

## 7. Currency Architecture

### 7.1 Storage Model

```
┌──────────────────────────────────────────────────────┐
│                   CURRENCY RULES                      │
├──────────────────────────────────────────────────────┤
│ 1. Canonical storage: minor units (integers)         │
│    → NPR 1,500.00 stored as 150000                   │
│    → USD 10.00 stored as 1000                        │
│    → JPY 1000 stored as 1000 (0 decimal currency)    │
│                                                      │
│ 2. ISO 4217 enforcement:                             │
│    → Currency codes validated against DB table        │
│    → No 'Rs.' or '₹' in storage — only 'NPR', 'INR'│
│                                                      │
│ 3. Formatting is display-only:                       │
│    → Formatting rules stored in currency_config table│
│    → Symbol, position, grouping, decimal separator   │
│    → Locale-aware via Intl.NumberFormat              │
│                                                      │
│ 4. Conversion is optional:                           │
│    → FxService for display conversion                │
│    → Canonical amount never changes                  │
│    → Booking always stored in listing's currency     │
└──────────────────────────────────────────────────────┘
```

### 7.2 Currency Configuration Table

```sql
CREATE TABLE currency_config (
  code        VARCHAR(3)  PRIMARY KEY,         -- ISO 4217: 'NPR'
  name        VARCHAR(50) NOT NULL,            -- 'Nepalese Rupee'
  name_local  VARCHAR(50),                     -- 'नेपाली रुपैयाँ'
  symbol      VARCHAR(10) NOT NULL,            -- 'Rs.'
  symbol_local VARCHAR(10),                    -- 'रु'
  decimals    INT         NOT NULL DEFAULT 2,  -- Minor unit digits
  symbol_position VARCHAR(6) DEFAULT 'before', -- 'before' | 'after'
  grouping_separator VARCHAR(2) DEFAULT ',',
  decimal_separator  VARCHAR(2) DEFAULT '.',
  intl_locale VARCHAR(10),                     -- 'ne-NP' for Intl.NumberFormat
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Adding a new currency (e.g., BDT — Bangladeshi Taka):

```sql
INSERT INTO currency_config (code, name, name_local, symbol, symbol_local, decimals, symbol_position, intl_locale)
VALUES ('BDT', 'Bangladeshi Taka', 'বাংলাদেশি টাকা', '৳', '৳', 2, 'before', 'bn-BD');
```

**Zero code changes.** The `CurrencyService` reads from this table. The web frontend's `useLocaleFormatters` hook delegates to `Intl.NumberFormat` with the `intl_locale` value.

### 7.3 FX Conversion Flow

```
User A (Nepal) lists a room for NPR 5,000/day
User B (India) browses in INR preference

Display flow:
1. Listing.basePrice = 500000 (minor units, NPR)
2. User B's preferredCurrency = 'INR'
3. FxService.convert(5000, 'NPR', 'INR') → ₹3,125
4. Display: "₹3,125/day (NPR 5,000)"
5. Booking created in NPR 5,000 (canonical currency)
6. Tax calculated on NPR 5,000 (Nepal jurisdiction)
```

---

## 8. Localization Architecture

### 8.1 Current Implementation (Enhanced)

The system uses `react-i18next` with JSON catalogs:

```
apps/web/app/locales/
  ├── en.json    (1,941 keys)
  └── ne.json    (1,941 keys — full parity)
```

The API uses `LocaleInterceptor` to resolve `Accept-Language` → `request.locale` and an `I18nExceptionFilter` for localized error messages.

### 8.2 Extended Architecture for Global Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                 LOCALIZATION ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │  Translation Store   │    │  Locale Config DB    │            │
│  │  (JSON catalogs)    │    │                      │            │
│  │                     │    │  locale_config:      │            │
│  │  en.json (English)  │    │   code: 'hi'         │            │
│  │  ne.json (Nepali)   │    │   name: 'Hindi'      │            │
│  │  hi.json (Hindi)    │    │   native: 'हिन्दी'    │            │
│  │  bn.json (Bengali)  │    │   direction: 'ltr'   │            │
│  │  ...                │    │   fallback: 'en'     │            │
│  └─────────┬───────────┘    │   date_format: 'dd/  │            │
│            │                │     MM/yyyy'         │            │
│            ▼                │   is_active: true    │            │
│  ┌─────────────────────┐   └──────────┬───────────┘            │
│  │  i18next Runtime     │              │                        │
│  │                      │◀─────────────┘                        │
│  │  - Loads catalogs   │                                       │
│  │  - Key resolution   │   ┌─────────────────────┐            │
│  │  - Interpolation    │   │  Content Localization│            │
│  │  - Pluralization    │   │                      │            │
│  │  - Context variants │   │  ListingContent:     │            │
│  │  - Fallback chain   │   │   listing_id + lang  │            │
│  │                      │   │   → title, desc     │            │
│  └─────────────────────┘   └─────────────────────┘            │
│                                                                  │
│  Fallback Chain: ne → en (default)                              │
│  Adding Hindi:  1) Create hi.json  2) INSERT locale_config      │
│  RTL Support:   direction field in locale_config                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Pluralization

i18next handles pluralization natively. For Nepali (which has different plural rules than English):

```json
{
  "bookings": {
    "count_one": "{{count}} booking",
    "count_other": "{{count}} bookings"
  }
}
```

### 8.4 Content Localization

User-generated content (listing titles, descriptions) is localized via the existing `ListingContent` model:

```prisma
model ListingContent {
  id          String   @id @default(cuid())
  listingId   String
  lang        String   @db.VarChar(5)  // 'en', 'ne', 'hi'
  title       String
  description String?
  features    String[] // Localized feature labels
  rules       String[] // Localized house rules
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  listing Listing @relation(fields: [listingId], references: [id])
  @@unique([listingId, lang])
}
```

### 8.5 Adding a New Language

1. Create `apps/web/app/locales/hi.json` (can be auto-generated from en.json via translation API)
2. `INSERT INTO locale_config (code, name, native_name, direction, fallback, is_active) VALUES ('hi', 'Hindi', 'हिन्दी', 'ltr', 'en', true)`
3. The `LocaleInterceptor` reads active locales from DB, not from hardcoded constants

**Zero code changes in domain or UI layer.**

---

## 9. Booking Rules Engine

### 9.1 Dynamic Booking Constraints

All booking rules are stored as `BOOKING_CONSTRAINT` policy rules:

| Constraint | Condition | Action |
|-----------|-----------|--------|
| Min stay (EU spaces) | `country in ['DE','FR','IT'] AND category = 'SPACES'` | `SET_MIN_MAX { min: 2 }` |
| Max stay (NYC) | `city = 'New York' AND category = 'SPACES'` | `SET_MIN_MAX { max: 28 }` |
| Age restriction (vehicles) | `category = 'VEHICLES'` | `SET_MIN_MAX { minAge: 21 }` |
| ID requirement (Nepal owners) | `country = 'NP' AND role = 'OWNER'` | `REQUIRE_DOCUMENT { type: 'CITIZENSHIP' }` |
| Seasonal blackout | `city = 'Kathmandu' AND date in ['2026-04-13','2026-04-14']` | `BLOCK { reason: 'Bisket Jatra blackout' }` |
| Holiday pricing | `country = 'NP' AND date in dashainDates` | `SET_MULTIPLIER { 1.5 }` |
| Weekend pricing | `dayOfWeek in [5,6] AND category in ['SPACES','EVENT_VENUES']` | `SET_MULTIPLIER { 1.2 }` |

### 9.2 Evaluation Flow

```
BookingService.validateConstraints(context)
  │
  ├── PolicyEngine.evaluate('BOOKING_CONSTRAINT', context)
  │    │
  │    ├── Matched rules (sorted by priority):
  │    │   1. rule_us_ny_nyc_short_term  (city-level, priority=10)
  │    │   2. rule_eu_min_stay_spaces    (country-level, priority=100)
  │    │   3. rule_np_dashain_surcharge  (country-level, priority=200)
  │    │
  │    ├── Aggregate decisions:
  │    │   - BLOCK decisions: any BLOCK → reject booking
  │    │   - MIN_MAX decisions: take most restrictive
  │    │   - MULTIPLIER decisions: compound (multiply all)
  │    │   - REQUIRE_DOCUMENT decisions: union of all requirements
  │    │
  │    └── Return BookingConstraintDecision {
  │          isAllowed: true/false,
  │          blockedReasons: [...],
  │          minStay: 2,
  │          maxStay: null,
  │          minAge: null,
  │          requiredDocuments: ['CITIZENSHIP'],
  │          priceMultiplier: 1.2,
  │          appliedRules: ['rule_id_1', 'rule_id_2']
  │        }
  │
  └── If isAllowed === false → throw BookingBlockedException(blockedReasons)
```

### 9.3 Holiday/Blackout Date Management

Blackout dates and holiday calendars are stored as dedicated policy rules with `dateRange` conditions:

```json
{
  "id": "rule_np_dashain_2026",
  "type": "BOOKING_CONSTRAINT",
  "name": "Dashain Festival Surcharge 2026",
  "country": "NP",
  "conditions": [
    { "field": "country", "operator": "eq", "value": "NP" },
    { "field": "startDate", "operator": "dateRange", "value": ["2026-10-02", "2026-10-16"] },
    { "field": "listingCategory", "operator": "in", "value": ["SPACES", "EVENT_VENUES"] }
  ],
  "actions": [
    { "type": "SET_MULTIPLIER", "params": { "multiplier": 1.50, "label": "Dashain Festival surcharge" } }
  ],
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "effectiveTo": "2026-12-31T23:59:59Z"
}
```

---

## 10. Compliance Module

### 10.1 Country Compliance Packs

Each country is represented by a "compliance pack" — a collection of policy rules that covers all regulatory requirements:

```
┌────────────────────────────────────────────────────────────────┐
│           NEPAL COMPLIANCE PACK (v1.0)                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Tax Rules:                                                    │
│    ├── rule_np_vat_13            (VAT 13%)                    │
│    └── rule_np_tds_1_5           (TDS 1.5% for payments >50k)│
│                                                                │
│  Identity Requirements:                                        │
│    ├── rule_np_owner_citizenship (Owners need citizenship doc)│
│    └── rule_np_renter_id         (Renters need phone verified)│
│                                                                │
│  Payment Regulations:                                          │
│    ├── rule_np_nrb_settlement    (Must settle in NPR)         │
│    └── rule_np_khalti_esewa      (Khalti/eSewa mandatory)     │
│                                                                │
│  Data Retention:                                               │
│    └── rule_np_data_retention_5y (5-year retention per NRB)   │
│                                                                │
│  Booking Constraints:                                          │
│    └── rule_np_dashain_blackout  (Festival dates)             │
│                                                                │
│  Cancellation Rules:                                           │
│    └── rule_np_cancel_flexible   (24-hour free cancellation)  │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│              INDIA COMPLIANCE PACK (v1.0)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Tax Rules:                                                    │
│    ├── rule_in_gst_18            (GST 18% standard)           │
│    ├── rule_in_gst_12_budget     (GST 12% for budget rooms)   │
│    └── rule_in_tcs_5             (TCS 5% for NRI sellers)     │
│                                                                │
│  Identity Requirements:                                        │
│    ├── rule_in_pan_50k           (PAN for payments >₹50,000)  │
│    ├── rule_in_aadhaar_owner     (Aadhaar for owners)         │
│    └── rule_in_gstin_business    (GSTIN for business accounts)│
│                                                                │
│  Payment Regulations:                                          │
│    ├── rule_in_rbi_settlement    (INR settlement only)        │
│    └── rule_in_upi_mandate       (UPI mandatory for <₹1 lakh)│
│                                                                │
│  Data Retention:                                               │
│    └── rule_in_dpdpa_retention   (Per DPDPA 2023 data rules)  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 10.2 Compliance Pack Registration

```typescript
// Adding a compliance pack is purely data:
const indiaCompliancePack = {
  country: 'IN',
  version: '1.0',
  rules: [
    // Array of PolicyRule objects (see §4.5 examples)
  ],
  activatedAt: '2026-06-01T00:00:00Z',
  approvedBy: 'admin_xyz'
};

// Register via Admin API or direct DB migration
await policyService.registerCompliancePack(indiaCompliancePack);
```

### 10.3 Identity Requirements Matrix

| Country | User Type | Document Required | Threshold |
|---------|-----------|------------------|-----------|
| NP | Owner | Citizenship Certificate | Always |
| NP | Renter | Phone verification | Always |
| IN | Owner | Aadhaar + PAN | Always |
| IN | Renter | PAN card | Bookings > ₹50,000 |
| IN | Business | GSTIN | Always |
| US | Owner | SSN/EIN (tax reporting) | Annual earnings > $600 |
| EU | Owner | eIDAS identity | Always |
| EU | Renter | None (GDPR minimization) | — |

All stored as `IDENTITY` policy rules with `REQUIRE_DOCUMENT` actions.

---

## 11. Versioning Strategy

### 11.1 Policy Versioning Model

```
┌───────────────────────────────────────────────────────────────┐
│                   POLICY VERSION LIFECYCLE                      │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  v1 ─── ACTIVE ────────────────────────┐                      │
│  effectiveFrom: 2024-01-01             │                      │
│  effectiveTo: null                     │                      │
│                                        │                      │
│  v2 ─── DRAFT → PENDING → ACTIVE ─────┤                      │
│  effectiveFrom: 2026-04-01            │ v1 auto-expires      │
│  effectiveTo: null                    │ when v2 activates    │
│  supersedes: v1.id                    │                      │
│                                        │                      │
│  When v2 activates:                    │                      │
│    v1.effectiveTo = 2026-03-31T23:59  ◀┘                      │
│    v1.status = 'ARCHIVED'                                     │
│    v2.status = 'ACTIVE'                                       │
│                                                                │
│  Bookings created under v1 retain v1 snapshot forever.        │
│  New bookings after 2026-04-01 use v2.                       │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 11.2 Effective Dating

Rules are queried with `WHERE effective_from <= :evaluationDate AND (effective_to IS NULL OR effective_to > :evaluationDate)`.

For **future-dated rules** (e.g., "India GST rate change effective July 1, 2026"):
- Insert the new rule now with `effectiveFrom: 2026-07-01` and `status: ACTIVE`
- The old rule continues to be the winning match until June 30
- On July 1, the new rule automatically takes precedence
- No deployment, no cron job, no manual intervention

### 11.3 Backward Compatibility

- **Old bookings**: Always use their snapshotted rules. The booking's `metadata.taxSnapshot` is immutable.
- **Refund calculations**: Use the original booking's tax snapshot, not current rates.
- **Reporting**: Historical reports can filter by rule version and effective date range.

### 11.4 Migration Strategy

When restructuring the rule schema:

1. **Add** new fields with defaults (backward-compatible)
2. **Backfill** existing rules with appropriate values
3. **Mark** old-format rules as `ARCHIVED` once migrated
4. **Never delete** rules — only archive

### 11.5 Rollback

If a new rule causes issues:
1. Set the rule's `status = 'SUSPENDED'`
2. The previous active version (if any) automatically becomes the winning match again
3. No deployment required. Immediate effect via cache invalidation.

---

## 12. Audit & Explainability

### 12.1 Policy Decision Audit Record

Every policy evaluation produces an audit record:

```typescript
interface PolicyAuditRecord {
  id: string;
  timestamp: DateTime;

  // What was evaluated
  policyType: PolicyType;
  context: PolicyContext;         // Full input context (sanitized of PII)
  contextHash: string;           // SHA-256 of context for dedup

  // What matched
  candidateRules: string[];      // All rules considered
  matchedRules: string[];        // Rules whose conditions passed
  eliminatedRules: {             // Rules that didn't match and why
    ruleId: string;
    failedCondition: string;
    actualValue: any;
    expectedValue: any;
  }[];

  // What was decided
  decision: PolicyDecision;      // Final computed result
  decisionExplanation: string;   // Human-readable explanation

  // Traceability
  requestId: string;             // Correlation ID from original HTTP request
  userId: string | null;         // Who triggered this evaluation
  entityType: string;            // 'BOOKING' | 'LISTING' | 'PAYMENT'
  entityId: string | null;       // Related entity ID
}
```

### 12.2 Explainability Report

For regulatory audits, the system can generate an explainability report:

```
═══════════════════════════════════════════════════════════════
  POLICY DECISION REPORT
  Booking: bkg_abc123
  Date: 2026-03-02 10:30:00 +05:45
═══════════════════════════════════════════════════════════════

  CONTEXT:
    Country: NP (Nepal)
    Listing: lst_xyz (SPACES category, Kathmandu)
    Booking value: NPR 15,000
    Duration: 7 nights
    Start date: 2026-03-05 (Wednesday)

  TAX CALCULATION:
    ┌─────────────────────────────────────────────────────────┐
    │ Rule: rule_np_vat_13 v1 "Nepal Standard VAT"            │
    │ Match: country = 'NP' ✓                                 │
    │ Action: SET_RATE { VAT, 13% }                           │
    │ Computed: NPR 15,000 × 13% = NPR 1,950                 │
    │ Status: APPLIED                                         │
    └─────────────────────────────────────────────────────────┘

  FEE CALCULATION:
    ┌─────────────────────────────────────────────────────────┐
    │ Rule: rule_fee_np_standard v1 "Nepal Platform Fee 12%"  │
    │ Match: country = 'NP' AND bookingValue between          │
    │        [5000, 50000] ✓                                  │
    │ Action: SET_RATE { PLATFORM_FEE, 12% }                  │
    │ Computed: NPR 15,000 × 12% = NPR 1,800                 │
    │ Status: APPLIED                                         │
    └─────────────────────────────────────────────────────────┘

  BOOKING CONSTRAINTS:
    ┌─────────────────────────────────────────────────────────┐
    │ No BLOCK rules matched                                   │
    │ No weekend pricing (Wednesday start) ✓                   │
    │ No holiday pricing ✓                                     │
    │ Min stay 1 night, booking 7 nights ✓                    │
    └─────────────────────────────────────────────────────────┘

  FINAL BREAKDOWN:
    Subtotal:      NPR 15,000
    Platform fee:  NPR  1,800
    Nepal VAT:     NPR  1,950
    Total:         NPR 18,750

═══════════════════════════════════════════════════════════════
```

### 12.3 Audit Retention

| Data Category | Retention Period | Justification |
|---------------|-----------------|---------------|
| Policy decisions | 7 years | Tax audit requirements (Nepal NRB, India IT Act) |
| Rule change history | Indefinite | Regulatory traceability |
| Context logs (sanitized) | 3 years | Dispute resolution |
| PII-containing context | Per data retention policy | GDPR Art. 17, DPDPA 2023 |

---

## 13. Extensibility Simulation

### Simulation: Adding Bangladesh to GharBatai Rentals

**Requirements:**
- Currency: BDT (Bangladeshi Taka, ৳, 2 decimals)
- Tax: 15% VAT (Bangladesh VAT Act 2012)
- Language: Bengali (bn)
- Identity: NID card for owners, phone verification for renters
- Address format: Division → District → Upazila
- Cancellation: Consumer protection requires 72-hour cooling-off for spaces
- Payment: bKash & Nagad integration, BDT settlement only
- Timezone: Asia/Dhaka (UTC+6)

**Step-by-step — ALL database operations, ZERO code changes:**

#### Step 1: Currency Registration
```sql
INSERT INTO currency_config (code, name, name_local, symbol, symbol_local, decimals, symbol_position, intl_locale)
VALUES ('BDT', 'Bangladeshi Taka', 'বাংলাদেশী টাকা', '৳', '৳', 2, 'before', 'bn-BD');
```

#### Step 2: Locale Registration
```sql
INSERT INTO locale_config (code, name, native_name, direction, fallback, date_format, is_active)
VALUES ('bn', 'Bengali', 'বাংলা', 'ltr', 'en', 'dd/MM/yyyy', true);
```

#### Step 3: Translation Catalog
Create `apps/web/app/locales/bn.json` (machine-translated from en.json, human-reviewed).

#### Step 4: Tax Rules
```sql
INSERT INTO policy_rules (id, type, name, description, country, jurisdiction_priority, version, effective_from, priority, conditions, actions, status)
VALUES (
  'rule_bd_vat_15',
  'TAX',
  'Bangladesh VAT 15%',
  'Standard VAT at 15% per Bangladesh VAT Act 2012',
  'BD', 1, 1, '2024-01-01',
  100,
  '[{"field":"country","operator":"eq","value":"BD"}]',
  '[{"type":"SET_RATE","params":{"taxType":"VAT","name":"Bangladesh VAT","rate":15.0,"jurisdiction":"Bangladesh"}}]',
  'ACTIVE'
);
```

#### Step 5: Identity Requirements
```sql
INSERT INTO policy_rules (id, type, name, country, conditions, actions, status)
VALUES (
  'rule_bd_owner_nid',
  'IDENTITY',
  'Bangladesh Owner NID Requirement',
  'BD',
  '[{"field":"country","operator":"eq","value":"BD"},{"field":"userRole","operator":"eq","value":"OWNER"}]',
  '[{"type":"REQUIRE_DOCUMENT","params":{"documentType":"NID_CARD","label":"National ID Card"}}]',
  'ACTIVE'
);
```

#### Step 6: Cancellation Policy
```sql
INSERT INTO policy_rules (id, type, name, country, conditions, actions, status)
VALUES (
  'rule_bd_cancel_cooling_off',
  'CANCELLATION',
  'Bangladesh 72-Hour Cooling-Off',
  'BD',
  '[{"field":"country","operator":"eq","value":"BD"},{"field":"listingCategory","operator":"eq","value":"SPACES"}]',
  '[{"type":"SET_OBJECT","params":{"coolingOffHours":72,"fullRefundHours":72,"partialRefundHours":168,"partialRefundPercent":50}}]',
  'ACTIVE'
);
```

#### Step 7: Payment Settlement Rule
```sql
INSERT INTO policy_rules (id, type, name, country, conditions, actions, status)
VALUES (
  'rule_bd_bdt_settlement',
  'COMPLIANCE',
  'Bangladesh BDT Settlement Only',
  'BD',
  '[{"field":"country","operator":"eq","value":"BD"}]',
  '[{"type":"SET_ENUM","params":{"settlementCurrency":"BDT","mandatoryMethods":["BKASH","NAGAD"]}}]',
  'ACTIVE'
);
```

#### Step 8: FX Rate Seeded

```sql
-- FxService will auto-fetch from API, but seed static fallback:
INSERT INTO fx_rate_snapshots (base, target, rate, source, fetched_at)
VALUES ('BDT', 'USD', 0.0083, 'static-seed', NOW()),
       ('USD', 'BDT', 120.0, 'static-seed', NOW()),
       ('BDT', 'NPR', 1.1, 'static-seed', NOW()),
       ('NPR', 'BDT', 0.91, 'static-seed', NOW());
```

**Result:** Bangladesh is fully operational. The core domain layer (`BookingService`, `PaymentService`, `ListingService`, `TaxCalculationService`) has ZERO awareness of Bangladesh. All behavior is driven by policy rules resolved at runtime.

---

## 14. Performance Considerations

### 14.1 Rule Caching Strategy

```
┌────────────────────────────────────────────────────────────────┐
│                   CACHING ARCHITECTURE                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L1: In-Memory (per-instance)                                  │
│    ├── TTL: 60 seconds                                         │
│    ├── Key: policy:{type}:{country}:{state}:{city}            │
│    ├── Size: ~500 rules × ~2KB = ~1MB per instance            │
│    └── Invalidation: pub/sub from Redis on rule change        │
│                                                                │
│  L2: Redis (shared)                                            │
│    ├── TTL: 5 minutes                                          │
│    ├── Key: Same as L1                                         │
│    ├── Warming: On deploy + on rule change                    │
│    └── Invalidation: Direct on write                          │
│                                                                │
│  L3: Database (source of truth)                                │
│    ├── Query: Indexed on (type, country, state, status)       │
│    ├── Materialized view for active rules (optional)          │
│    └── Avg query time: <2ms with proper indexes               │
│                                                                │
│  Cache invalidation flow:                                      │
│    Admin updates rule → DB write → Redis PUBLISH 'rule:change'│
│    → All instances clear L1 cache for affected scope           │
│    → Next request rebuilds L1 + L2 from L3                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 14.2 Precompiled Rule Trees

For hot paths (tax calculation on every booking), the engine can precompile rules into decision trees:

```
PolicyEngine.precompile('TAX', 'NP')
  → Builds: {
      'NP:*:*': [rule_np_vat_13],           // O(1) lookup
      'NP:BG-3:*': [rule_np_vat_13],        // Inherits from country
      'NP:BG-3:Kathmandu': [rule_np_vat_13, rule_np_ktm_tourism_tax]
    }

Evaluation: O(1) hash lookup instead of O(n) rule scanning
```

### 14.3 Performance Targets

| Operation | Target Latency | Strategy |
|-----------|---------------|----------|
| Tax calculation | < 5ms (p99) | L1 cache + precompiled tree |
| Fee calculation | < 5ms (p99) | L1 cache |
| Booking constraint check | < 10ms (p99) | L1 cache + early termination on BLOCK |
| Full context resolution | < 3ms (p99) | Parallel resolution of user + listing + geo |
| Audit log write | < 2ms (p99) | Async write via queue |

### 14.4 Horizontal Scalability

- PolicyEngine is **stateless** (all state in DB/Redis)
- Each API instance runs its own L1 cache
- Redis pub/sub ensures cache coherence across instances
- Rule evaluation is CPU-bound, not IO-bound (after cache hit)
- Audit writes are queued (Bull/Redis) for async persistence

---

## 15. Failure Handling

### 15.1 No-Match Strategy

```
┌───────────────────────────────────────────────────────────────┐
│              FAILURE MODE: NO RULES MATCH                      │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Scenario: User from Bangladesh, but no TAX rules for BD yet  │
│                                                                │
│  Resolution hierarchy:                                         │
│                                                                │
│  1. Check for wildcard rule:                                   │
│     type = 'TAX', country = '*'                               │
│     → "Global Default Tax: 0%"                                │
│                                                                │
│  2. If no wildcard: SAFE MODE                                  │
│     → Return zero tax (don't block the transaction)           │
│     → Log WARNING with full context                           │
│     → Fire alert to PolicyAlertService                        │
│     → Mark transaction as 'TAX_POLICY_MISSING'               │
│                                                                │
│  3. PolicyAlertService:                                        │
│     → Slack notification to #policy-ops channel               │
│     → Email to policy-team@gharbatai.com                      │
│     → Create JIRA ticket (if integated)                       │
│     → Increment metric: policy.no_match.{type}.{country}     │
│                                                                │
│  NEVER block a user action due to missing policy.             │
│  Default to the most permissive safe behavior.                │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 15.2 Default Fallback Policies

Every `PolicyType` has a mandatory global fallback rule with `country = '*'`:

| Type | Default Fallback |
|------|-----------------|
| `TAX` | 0% tax (safe: undertaxing is fixable; overtaxing is not) |
| `FEE` | 10% platform fee (reasonable global default) |
| `PRICING` | No multiplier (1.0×) |
| `CANCELLATION` | Flexible (full refund 24h before) |
| `BOOKING_CONSTRAINT` | No restrictions |
| `COMPLIANCE` | No additional requirements |
| `CURRENCY` | Use listing's currency as-is |
| `IDENTITY` | Phone verification only |

### 15.3 Alerting Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| `policy.no_match.count` per 5min | > 10 | Page on-call |
| `policy.evaluation.latency.p99` | > 50ms | Warn to Slack |
| `policy.cache.miss_rate` | > 20% | Investigation |
| `policy.rule.expiring_soon` | < 7 days to expiry | Email policy team |
| `policy.fallback.used` | Any | Log + investigate within 24h |

---

## 16. Security Considerations

### 16.1 Access Control Matrix

| Action | Admin | Policy Manager | Policy Viewer | Domain Service |
|--------|-------|---------------|---------------|----------------|
| View active rules | ✓ | ✓ | ✓ | ✓ (via PolicyEngine only) |
| Create rule (DRAFT) | ✓ | ✓ | ✗ | ✗ |
| Approve rule | ✓ | ✗ | ✗ | ✗ |
| Suspend rule | ✓ | ✓ | ✗ | ✗ |
| Archive rule | ✓ | ✗ | ✗ | ✗ |
| Delete rule | ✗ | ✗ | ✗ | ✗ (rules are NEVER deleted) |
| View audit logs | ✓ | ✓ | ✓ | ✗ |
| Export audit logs | ✓ | ✗ | ✗ | ✗ |
| Modify rule engine code | ✗ | ✗ | ✗ | ✗ (code is frozen) |

### 16.2 Approval Workflow

```
Rule Creation Flow:
  Policy Manager creates rule → status: DRAFT
  Policy Manager submits for review → status: PENDING_APPROVAL
  Admin reviews + approves → status: ACTIVE
  System auto-activates when effectiveFrom is reached

Emergency Override:
  Admin can directly activate a rule (bypassing approval)
  Emergency overrides are flagged in audit log
  Post-incident review required within 48 hours
```

### 16.3 Tamper Resistance

- All rule changes are recorded in `audit_logs` with `oldValues` and `newValues`
- Rule records have `updatedAt` timestamps
- Critical rules can be signed with HMAC (optional: `metadata.signature`)
- Database write access to `policy_rules` is restricted to the application service account
- No direct SQL access allowed in production

### 16.4 Change Audit Trail

Every rule modification generates an `AuditLog` entry:

```typescript
{
  action: 'POLICY_RULE_UPDATED',
  entityType: 'PolicyRule',
  entityId: 'rule_np_vat_13',
  oldValues: '{"rate": 13.0}',
  newValues: '{"rate": 15.0}',
  userId: 'admin_xyz',
  metadata: '{"reason": "Nepal Finance Act 2027 VAT increase", "approvedBy": "admin_abc"}',
  ipAddress: '103.1.92.x',
  createdAt: '2027-03-15T10:00:00Z'
}
```

---

## 17. Implementation Options

### 17.1 Comparison Matrix

| Approach | Flexibility | Performance | Complexity | Testability | Recommended |
|----------|------------|-------------|------------|-------------|-------------|
| **Custom JSON Evaluator** | ★★★★ | ★★★★★ | ★★★ | ★★★★★ | **YES** |
| Decision Tables (Drools-like) | ★★★★★ | ★★★ | ★★★★★ | ★★★ | No |
| Expression Engine (CEL/JMESPath) | ★★★★★ | ★★★★ | ★★★★ | ★★★★ | Alternative |
| Full DSL (Rego/OPA) | ★★★★★ | ★★★ | ★★★★★ | ★★★★ | Too heavy |
| External Rules SaaS (LaunchDarkly) | ★★★ | ★★★★ | ★★ | ★★★ | No (data residency) |

### 17.2 Recommended Approach: Custom JSON Evaluator

**Why:** For a rental marketplace at GharBatai's scale (tens of thousands of transactions/day, not millions), a custom JSON-based rule evaluator offers:

1. **Full ownership**: No external dependency for a critical business path
2. **Type safety**: TypeScript evaluator with compile-time validation of condition operators
3. **Performance**: Simple JSON comparison operators are microsecond-level
4. **Testability**: Each rule is a pure data object, testable with `evaluateConditions(rule, context)`
5. **Debuggability**: Full control over logging, tracing, error messages
6. **No learning curve**: Team already works in TypeScript; no Rego/Drools DSL to learn

**When to upgrade**: If rule complexity grows to require nested boolean logic (`AND(OR(condition1, condition2), condition3)`), migrate to an expression engine like CEL (Common Expression Language).

### 17.3 Implementation Architecture

```typescript
// RuleEvaluator — pure function, zero side effects
export class RuleEvaluator {
  evaluate(conditions: RuleCondition[], context: PolicyContext): EvaluationResult {
    const results = conditions.map(c => this.evaluateCondition(c, context));
    return {
      matched: results.every(r => r.matched),
      trace: results  // Full explainability
    };
  }

  private evaluateCondition(condition: RuleCondition, context: PolicyContext): ConditionResult {
    const actualValue = this.resolveField(condition.field, context);
    const result = this.compare(actualValue, condition.operator, condition.value);
    return {
      field: condition.field,
      operator: condition.operator,
      expected: condition.value,
      actual: actualValue,
      matched: condition.negate ? !result : result
    };
  }

  private compare(actual: any, operator: ConditionOperator, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'neq': return actual !== expected;
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'nin': return Array.isArray(expected) && !expected.includes(actual);
      case 'between': return actual >= expected[0] && actual <= expected[1];
      case 'contains': return String(actual).includes(String(expected));
      case 'exists': return actual !== null && actual !== undefined;
      case 'dayOfWeek': {
        const day = new Date(actual).getDay();
        return Array.isArray(expected) && expected.includes(day);
      }
      case 'dateRange': {
        const date = new Date(actual);
        return date >= new Date(expected[0]) && date <= new Date(expected[1]);
      }
      case 'always': return true;
      default: return false;
    }
  }
}
```

---

## 18. Deliverables & Data Models

### 18.1 Database Schema (New Tables)

```sql
-- ══════════════════════════════════════════════════════════
-- POLICY ENGINE TABLES
-- ══════════════════════════════════════════════════════════

-- Master policy rules table
CREATE TABLE policy_rules (
  id                     TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type                   VARCHAR(30) NOT NULL,          -- TAX, FEE, PRICING, etc.
  name                   VARCHAR(200) NOT NULL,
  description            TEXT,

  -- Jurisdiction scope
  country                VARCHAR(3)  NOT NULL DEFAULT '*', -- ISO 3166-1 or '*'
  state                  VARCHAR(20),
  city                   VARCHAR(100),
  jurisdiction_priority  INT         NOT NULL DEFAULT 0,   -- 0=global, 1=country, 2=state, 3=city

  -- Versioning
  version                INT         NOT NULL DEFAULT 1,
  effective_from         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to           TIMESTAMPTZ,
  supersedes             TEXT        REFERENCES policy_rules(id),

  -- Evaluation
  priority               INT         NOT NULL DEFAULT 100,  -- Lower = higher priority
  conditions             JSONB       NOT NULL DEFAULT '[]',
  actions                JSONB       NOT NULL DEFAULT '[]',

  -- Governance
  status                 VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  created_by             TEXT,
  approved_by            TEXT,
  approved_at            TIMESTAMPTZ,
  tags                   TEXT[]      DEFAULT '{}',

  -- Metadata
  metadata               JSONB       DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','SUSPENDED','ARCHIVED')),
  CONSTRAINT valid_type CHECK (type IN ('TAX','FEE','PRICING','CANCELLATION','BOOKING_CONSTRAINT','COMPLIANCE','CURRENCY','IDENTITY'))
);

CREATE INDEX idx_policy_rules_type_country ON policy_rules (type, country, status);
CREATE INDEX idx_policy_rules_effective ON policy_rules (effective_from, effective_to);
CREATE INDEX idx_policy_rules_tags ON policy_rules USING gin (tags);
CREATE INDEX idx_policy_rules_conditions ON policy_rules USING gin (conditions);

-- Policy audit trail
CREATE TABLE policy_audit_log (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  policy_type       VARCHAR(30) NOT NULL,
  context           JSONB       NOT NULL,
  context_hash      VARCHAR(64) NOT NULL,
  candidate_rules   TEXT[]      DEFAULT '{}',
  matched_rules     TEXT[]      DEFAULT '{}',
  eliminated_rules  JSONB       DEFAULT '[]',
  decision          JSONB       NOT NULL,
  explanation       TEXT,
  request_id        TEXT,
  user_id           TEXT,
  entity_type       VARCHAR(30),
  entity_id         TEXT,
  evaluation_ms     FLOAT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_audit_type ON policy_audit_log (policy_type, created_at);
CREATE INDEX idx_policy_audit_entity ON policy_audit_log (entity_type, entity_id);
CREATE INDEX idx_policy_audit_user ON policy_audit_log (user_id, created_at);

-- Currency configuration
CREATE TABLE currency_config (
  code              VARCHAR(3)  PRIMARY KEY,
  name              VARCHAR(50) NOT NULL,
  name_local        VARCHAR(50),
  symbol            VARCHAR(10) NOT NULL,
  symbol_local      VARCHAR(10),
  decimals          INT         NOT NULL DEFAULT 2,
  symbol_position   VARCHAR(6)  DEFAULT 'before',
  grouping_sep      VARCHAR(2)  DEFAULT ',',
  decimal_sep       VARCHAR(2)  DEFAULT '.',
  intl_locale       VARCHAR(15),
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locale configuration
CREATE TABLE locale_config (
  code              VARCHAR(10) PRIMARY KEY,
  name              VARCHAR(50) NOT NULL,
  native_name       VARCHAR(50) NOT NULL,
  direction         VARCHAR(3)  NOT NULL DEFAULT 'ltr',  -- 'ltr' | 'rtl'
  fallback          VARCHAR(10) NOT NULL DEFAULT 'en',
  date_format       VARCHAR(20) DEFAULT 'yyyy-MM-dd',
  time_format       VARCHAR(20) DEFAULT 'HH:mm',
  number_grouping   VARCHAR(10) DEFAULT ',',
  decimal_separator VARCHAR(2)  DEFAULT '.',
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Country configuration
CREATE TABLE country_config (
  code              VARCHAR(3)  PRIMARY KEY,             -- ISO 3166-1 alpha-2
  name              VARCHAR(100) NOT NULL,
  name_local        VARCHAR(100),
  default_currency  VARCHAR(3)  NOT NULL,
  default_locale    VARCHAR(10) NOT NULL,
  default_timezone  VARCHAR(50) NOT NULL,
  phone_prefix      VARCHAR(5),
  address_format    JSONB       DEFAULT '{}',            -- { fields: [...], order: [...] }
  supported_payment_methods TEXT[] DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  compliance_pack_version VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 18.2 Governance Model

```
┌───────────────────────────────────────────────────────────────┐
│                  POLICY GOVERNANCE MODEL                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Roles:                                                        │
│    • Policy Admin: Full CRUD + approve                        │
│    • Policy Manager: Create, edit, submit for approval        │
│    • Policy Viewer: Read-only access to rules + audits        │
│    • System: Evaluate rules (no write access)                 │
│                                                                │
│  Change Process:                                               │
│    1. Policy Manager creates rule → DRAFT                     │
│    2. Policy Manager assigns tags + tests rule                │
│    3. Policy Manager submits → PENDING_APPROVAL               │
│    4. Policy Admin reviews:                                    │
│       a. Checks conditions for correctness                    │
│       b. Checks actions for compliance                        │
│       c. Verifies effectiveFrom date                          │
│       d. Reviews impact analysis (which bookings affected)    │
│    5. Policy Admin approves → ACTIVE (or rejects → DRAFT)    │
│                                                                │
│  Emergency Process:                                            │
│    1. Policy Admin creates rule with status = ACTIVE          │
│    2. Flagged as EMERGENCY_OVERRIDE in metadata               │
│    3. Automatic alert to entire policy team                   │
│    4. Post-incident review within 48 hours                    │
│                                                                │
│  Review Cadence:                                               │
│    • Monthly: Review all active rules for accuracy            │
│    • Quarterly: Review compliance packs per jurisdiction       │
│    • Annually: Full audit of all rules + versions             │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 18.3 Operational Model

```
┌───────────────────────────────────────────────────────────────┐
│                  OPERATIONAL RUNBOOK                           │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Adding a New Country:                                         │
│    1. INSERT INTO country_config                              │
│    2. INSERT INTO currency_config (if new currency)           │
│    3. INSERT INTO locale_config (if new language)             │
│    4. INSERT INTO policy_rules (compliance pack)              │
│    5. Create translation catalog (locales/{lang}.json)        │
│    6. Seed FX rates (FxService auto-fetches live rates)       │
│    7. Test: Run policy evaluation for new country context     │
│    Timeline: 1-2 business days (no deploy)                    │
│                                                                │
│  Changing a Tax Rate:                                          │
│    1. Create new rule version with new rate                   │
│    2. Set effectiveFrom to the legal effective date           │
│    3. Set supersedes to old rule ID                           │
│    4. Submit for approval                                     │
│    5. On approval: old rule auto-expires                      │
│    Timeline: Same day (no deploy)                             │
│                                                                │
│  Emergency: Tax System Down:                                   │
│    1. Fallback rules (country='*') return 0% tax              │
│    2. Alert fires to #policy-ops                              │
│    3. Transactions proceed (safe mode: no tax > overtax)      │
│    4. Post-recovery: backfill correct tax for affected txns   │
│    SLA: <5 minutes to fallback, <4 hours to full recovery    │
│                                                                │
│  Monitoring:                                                   │
│    • Dashboard: Active rules by type, by country             │
│    • Alerts: Missing policies, evaluation latency, fallbacks │
│    • Reports: Weekly policy decision summary                  │
│    • Compliance: Quarterly audit export                       │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 18.4 Sequence Diagrams

#### Booking Creation with Full Policy Evaluation

```
Client          Controller      ContextResolver    PolicyEngine    RuleStore(DB)   AuditService
  │                │                  │                │                │               │
  │ POST /bookings │                  │                │                │               │
  │───────────────▶│                  │                │                │               │
  │                │ resolve(req,lst) │                │                │               │
  │                │─────────────────▶│                │                │               │
  │                │                  │─── build ──┐   │                │               │
  │                │                  │    context  │   │                │               │
  │                │                  │◀───────────┘   │                │               │
  │                │◀─ PolicyContext ──│                │                │               │
  │                │                  │                │                │               │
  │                │ evaluate('TAX', ctx)              │                │               │
  │                │──────────────────────────────────▶│                │               │
  │                │                  │                │ query rules    │               │
  │                │                  │                │───────────────▶│               │
  │                │                  │                │◀── rules[] ───│               │
  │                │                  │                │                │               │
  │                │                  │                │── evaluate ──┐ │               │
  │                │                  │                │   conditions │ │               │
  │                │                  │                │◀─────────────┘ │               │
  │                │                  │                │                │               │
  │                │                  │                │── execute ───┐ │               │
  │                │                  │                │   actions    │ │               │
  │                │                  │                │◀─────────────┘ │               │
  │                │                  │                │                │               │
  │                │◀── TaxBreakdown ──────────────────│                │               │
  │                │                  │                │                │               │
  │                │ evaluate('FEE', ctx)              │                │               │
  │                │──────────────────────────────────▶│                │               │
  │                │◀── FeeBreakdown ──────────────────│                │               │
  │                │                  │                │                │               │
  │                │ evaluate('BOOKING_CONSTRAINT', ctx)│               │               │
  │                │──────────────────────────────────▶│                │               │
  │                │◀── ConstraintResult ──────────────│                │               │
  │                │                  │                │                │               │
  │                │                  │                │ log(ctx,dec)   │               │
  │                │                  │                │───────────────────────────────▶│
  │                │                  │                │                │               │
  │                │── create booking ──┐              │                │               │
  │                │   with snapshots   │              │                │               │
  │                │◀──────────────────┘              │                │               │
  │                │                  │                │                │               │
  │◀── 201 Created │                  │                │                │               │
  │                │                  │                │                │               │
```

---

## Appendix A: Migration from Current System

### Phase 1: Foundation (Weeks 1-2)
- Create `policy_rules`, `policy_audit_log`, `currency_config`, `locale_config`, `country_config` tables
- Implement `RuleEvaluator` (pure function)
- Implement `PolicyEngine` (NestJS service)
- Implement `ContextResolver`
- Migrate existing `TaxRule` data into `policy_rules` format

### Phase 2: Tax Migration (Weeks 3-4)
- Replace hardcoded `Map<string, TaxRate[]>` in `TaxCalculationService` with `PolicyEngine.evaluate('TAX', ctx)`
- Migrate all static tax rates into `policy_rules` rows
- Add tax snapshot storage to booking metadata
- Test: All existing tax calculation tests pass with new engine

### Phase 3: Fee & Pricing (Weeks 5-6)
- Replace `fees.platformFeePercent` with `FEE` policy rules
- Implement dynamic pricing multipliers
- Wire into `BookingService.calculatePrice()`

### Phase 4: Booking Constraints & Compliance (Weeks 7-8)
- Migrate `CancellationPolicy` model to policy rules
- Implement `BOOKING_CONSTRAINT` evaluation
- Implement `IDENTITY` requirement checks
- Wire into booking creation flow

### Phase 5: Admin UI & Governance (Weeks 9-10)
- Admin panel for rule CRUD
- Approval workflow
- Audit log viewer
- Dashboard with rule analytics

### Phase 6: Global Launch Readiness (Weeks 11-12)
- Create compliance packs for target countries
- Load test policy engine under production traffic
- Security audit of policy access controls
- Documentation and team training

---

## Appendix B: Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Countries supported without code change | 0 | Unlimited |
| Time to add new country | ~2 weeks (engineering) | 1-2 days (ops) |
| Time to update tax rate | Hours (deploy cycle) | Minutes (DB update) |
| Policy evaluation latency (p99) | N/A (hardcoded) | < 5ms |
| Audit coverage | 0% | 100% of policy decisions |
| Rule testability | 0% | 100% (every rule independently testable) |
| Backward compatibility | Not ensured | Guaranteed via versioning |

---

*End of Global Policy & Rules Engine Architecture Specification v1.0.0*
