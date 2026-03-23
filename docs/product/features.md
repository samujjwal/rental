# Feature Catalog

This document is the canonical high-level feature inventory for the repository.
It should stay concise, current, and implementation-grounded.

## Marketplace Features

### Discovery And Search

- category browsing
- keyword search
- location-aware search and geospatial flows
- filters for price, date, and other listing metadata
- listing detail views with pricing and availability

### Authentication And Identity

- sign-up and login
- password recovery
- role-aware access control
- email verification and MFA-related flows
- KYC and identity checks where enabled

### Listing Management

- listing creation and editing
- category-specific listing fields
- media upload and content validation
- availability management
- listing completeness and publishing workflows

### Booking Lifecycle

- booking request or confirmation flow
- booking price calculation
- booking state machine and role-based actions
- booking detail, tracking, and status updates
- cancellation, refund, and return-related flows

### Payments And Financial Operations

- checkout and payment initiation
- tax and fee breakdowns
- escrow and payout support
- payment webhook handling and reconciliation-related services

### Communication And Trust

- renter-owner messaging
- notifications across email, SMS, push, and in-app channels
- favorites
- reviews and ratings
- moderation and fraud-related flows
- disputes and insurance handling

### Owner, Organization, And Admin Surfaces

- owner dashboards, insights, and calendar-style workflows
- organization management
- analytics and reporting surfaces
- admin moderation and operational controls

### Mobile Support

- core renter and owner flows on React Native / Expo
- mobile auth, browsing, booking, and settings paths
- Maestro flow coverage for mobile E2E validation

## Supporting System Features

- policy and compliance support
- search indexing and recommendation services
- observability and health endpoints
- load, security, smoke, and E2E testing support

## Source Material Consolidated Here

This feature catalog replaces the need to use these files as live source-of-truth docs:

- `COMPREHENSIVE_FEATURES_DOCUMENTATION.md`
- `RequirementsForRentalSystem.md`
- `MOBILE_SPEC.md`
- parts of app-local status and testing summaries
