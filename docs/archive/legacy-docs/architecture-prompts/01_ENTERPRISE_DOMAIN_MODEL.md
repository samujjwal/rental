# Prompt 1: Enterprise Rental Domain Model

## Executive Summary
This document outlines the foundational domain architecture for the Global Rental Ecosystem. Designed to support multi-currency, multi-locale, multi-timezone, multi-vertical, and multi-tenant requirements, the domain model is organized into strict Bounded Contexts. This ensures loose coupling and high cohesion across the massive global platform.

## 1. Bounded Contexts

To successfully manage enterprise scale at the level of Airbnb, Shopify, or Turo, the platform is divided into the following isolated Domain Bounded Contexts:

1. **Identity & Organization Context:** Manages identity, RBAC, organizations, and tenant boundaries.
2. **Catalog & Asset Context:** Manages listings, physical/digital assets, and their hierarchical categorization.
3. **Availability & Inventory Context:** Dedicated strictly to concurrency, availability windows, and holding/locking inventory.
4. **Booking & Reservation Context:** The lifecycle of a reservation from intent to completion.
5. **Financial & Billing Context:** Dynamic pricing, payment orchestration, multi-currency ledger, and global payouts.
6. **Trust, Safety & Moderation Context:** Reviews, disputes, fraud signals, and dynamic trust scoring.

---

## 2. Domain Aggregates & Entities

### A. Identity & Organization Aggregate
* **User (Root):** Global identity, locale preferences, timezone.
* **Role/Persona:** Renter, Host, Admin. A User can have multiple personas.
* **Organization:** Multi-tenant container for B2B/Enterprise hosts.
* **TrustProfile:** Links to Trust Signals, KYC (Know Your Customer) verifications.

### B. Catalog & Asset Aggregate
* **Listing (Root):** The marketing entity shown to users. Contains localized descriptions, multi-modal media.
* **Asset:** The physical or virtual item being rented (e.g., specific Car, specific Apartment).
* **Inventory Unit:** The exact schedulable unit of an Asset (e.g., Room 302 of Building A). 
* **Metadata/Vertical Config:** Dynamic schema to support multi-verticals (Cars vs Real Estate vs Equipment).

### C. Booking & Reservation Aggregate
* **Booking (Root):** Represents the agreed contract between Renter and Host.
* **Reservation:** The temporal block of the Inventory Unit. Can have states: `Pending`, `Confirmed`, `Active`, `Completed`, `Cancelled`.
* **Guest Manifest:** Details of the end-users utilizing the booking.

### D. Availability & Inventory Aggregate
* **Availability Window (Root):** Time-series representation of status (`Available`, `Blocked`, `Maintenance`).
* **Inventory Lock:** Short-lived concurrency lock during checkout.

### E. Financial & Billing Aggregate
* **Pricing Rule (Root):** Dynamic rules applied to Listings (Base Price, Weekend Multiplier, Demand Surge).
* **Payment Intent:** Orchestrated payment object abstracting Stripe/Adyen/etc.
* **Ledger Entry:** Immutable double-entry bookkeeping for tracking Multi-currency Escrow.
* **Payout:** Scheduled disbursement to Host(s) incorporating platform fees and Global Tax deductions.

### F. Trust & Safety Aggregate
* **Review (Root):** Bi-directional feedback mechanism.
* **Dispute:** Escalation workflow tied to a Booking.
* **Insurance Claim:** Workflow involving 3rd-party underwriters.
* **Fraud Signal:** Event-driven AI scoring indicating malicious activity.

---

## 3. Domain Services

When logic crosses Aggregate boundaries, we employ Domain Services:

1. **`SearchAndDiscoveryService`:** Joins Catalog Aggregates with Availability Aggregates to safely display available inventory.
2. **`CheckoutOrchestratorService`:** Uses the Saga pattern to coordinate Inventory Lock, Payment Authorization, and Booking Confirmation across contexts.
3. **`TaxCalculationService`:** Invokes Regional Policy Packs to inject appropriate tax line items into the Financial Aggregate before payment execution.
4. **`LiquidityCalculationService`:** Feeds booking density data to the Marketplace Liquidity Engine.

---

## Architecture Observations
- Multi-currency and Multi-timezone are pushed to the edges (UI/API layer); internally, all systems use UTC and base system currency (or standardized precision integers) for ledgers.
- Multi-vertical support is achieved via the separation of `Listing` (presentation) from `Asset` (physical constraint) and schema-less JSONB/NoSQL metadata properties.

## Extensibility Assessment
- **High:** The use of clear Bounded Contexts allows the Trust Context to be scaled independently of the Catalog Context. Adding a new vertical simply requires defining a new Asset Metadata schema without modifying the Booking or Payment cores.

## Critical Findings
- **Severity: High** - The mapping between an `Asset` and its `Inventory Unit(s)` must be strictly modeled to avoid overbooking when dealing with fractional rentals (e.g., renting an entire house vs. renting individual rooms in that house simultaneously).