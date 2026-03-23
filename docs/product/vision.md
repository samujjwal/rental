# Product Vision

The Rental Portal is a multi-category marketplace for discovering, booking, and
managing rentals across spaces, vehicles, instruments, event assets, wearables,
and other rentable inventory.

## What The Platform Must Do

- help renters find available inventory quickly
- let owners list, price, and manage rentable items with low friction
- support secure booking, payment, messaging, reviews, disputes, and operations
- give admins enough observability and controls to keep the marketplace healthy

## Primary User Roles

- `guest`
  Browse marketing content, search inventory, inspect listings, and begin sign-up.
- `renter`
  Search, favorite, message, book, pay, review, dispute, and manage profile settings.
- `owner`
  Create listings, manage inventory and availability, respond to bookings, handle
  payouts, and operate as an individual or organization.
- `admin`
  Moderate content, oversee disputes, review analytics, and support platform operations.

## Product Principles

- marketplace-first
  The product should optimize for successful discovery, trust, and conversion.
- category-flexible
  The domain model should support different inventory classes without rebuilding
  the product for each category.
- operationally credible
  Payments, disputes, moderation, notifications, and support flows are part of
  the product, not afterthoughts.
- low-friction
  Common flows should be understandable without training for renters and owners.
- implementation-grounded
  Live documentation should describe what the current codebase supports, while
  clearly separating shipped capability from future ambition.

## Current Product Scope

The repository implements or partially implements these core areas:

- marketing and discovery
- authentication and account recovery
- listing creation and listing management
- search and browse
- booking lifecycle management
- checkout, payments, escrow, and payouts
- messaging and notifications
- reviews and favorites
- disputes and insurance
- organizations, analytics, and admin operations
- mobile access for core renter and owner journeys

## Related Canonical Docs

- [`requirements.md`](requirements.md)
- [`features.md`](features.md)
