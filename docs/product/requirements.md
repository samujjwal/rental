# Product Requirements

This document is the canonical home for durable product requirements. It
consolidates the original requirements list and the current implemented product
surface into one place.

## Core Marketplace Requirements

### Discovery

- Users must be able to browse and search rentable inventory by category,
  keyword, price, date, and location.
- Listings must present title, description, images, pricing, availability, and
  rules in a consistent format.
- The system should support category-specific metadata without breaking common
  browse and booking flows.

### Accounts And Roles

- The system must support at least renter, owner, and admin roles.
- Users must be able to register, authenticate, recover accounts, and manage profiles.
- Access permissions must differ by role and by protected operation.

### Listing Management

- Owners must be able to create, edit, publish, and manage listings.
- Owners must be able to set pricing, availability, and listing-specific rules.
- The platform must support category-specific listing fields where needed.

### Booking And Payments

- Renters must be able to select dates, request or confirm bookings, and pay online.
- The system must calculate price totals, taxes, fees, and booking cost breakdowns clearly.
- Booking confirmations should be visible in-product and delivered via notification channels.
- Owners must be able to approve, reject, or otherwise process bookings according to the state model.

### Trust, Reviews, And Disputes

- Users must be able to leave ratings and reviews after eligible transactions.
- The platform must support moderation, abuse controls, and dispute handling.
- Admin workflows must exist for investigating and resolving platform issues.

### Admin And Operations

- Admin users must be able to review listings, manage disputes, and inspect platform activity.
- The system must expose operational health, traceability, and audit-friendly flows.

## Category-Specific Requirements

### Vehicles And Transport

- pickup and drop-off behavior
- license and identity verification support
- insurance and damage-handling support

### Clothing And Wearables

- sizes and measurements
- condition and handoff checklists
- care instructions

### Homes, Spaces, And Venues

- check-in and check-out rules
- calendar blocking and availability controls
- security deposit behavior where required

## Non-Functional Requirements

- consistent API and UI behavior across web and mobile where flows overlap
- reliable booking and payment state transitions
- operational visibility through runbooks, SLOs, and health checks
- automated validation through unit, integration, E2E, security, and load tests
- documentation that stays aligned with implemented behavior

## Traceability

Requirement-to-test and requirement-to-implementation mapping should live in
[`../traceability/requirements-matrix.md`](../traceability/requirements-matrix.md).
