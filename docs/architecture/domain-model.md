# Domain Model

This document summarizes the core bounded contexts and domain aggregates that
shape the rental platform.

## Bounded Contexts

- identity and organization
  Users, roles, organizations, permissions, and trust-adjacent identity signals.
- catalog and asset management
  Listings, assets, inventory units, and category-specific metadata.
- availability and inventory
  Availability windows, blocking, schedulable units, and short-lived locks.
- booking and reservation
  Booking lifecycle, reservation state, participants, and contractual flow.
- financial and billing
  Pricing rules, payment intents, escrow, ledger entries, taxes, and payouts.
- trust and safety
  Reviews, disputes, fraud signals, moderation, and insurance-related workflows.

## Key Aggregates

### Identity And Organization

- `User`
- `Role` / persona
- `Organization`
- trust and verification profile concepts

### Catalog And Asset

- `Listing`
- `Asset`
- `InventoryUnit`
- category metadata / extensible field models

### Booking

- `Booking`
- reservation state and temporal allocation
- participant and guest-related data

### Availability

- availability window or slot representation
- short-lived inventory or checkout lock

### Financial

- pricing rule
- payment intent / command
- ledger entry
- payout
- tax-related decision artifacts

### Trust And Safety

- review
- dispute
- insurance claim
- fraud signal

## Domain Service Patterns

Cross-boundary flows are handled through domain or orchestration services such as:

- search and discovery composition
- checkout orchestration
- tax and policy resolution
- pricing and liquidity-related services

## Implementation Notes

- category flexibility depends on separating listing presentation concerns from
  inventory and fulfillment constraints
- booking correctness depends on accurate inventory-unit modeling and reliable
  state transitions
- policy and jurisdiction logic should stay outside core domain conditionals and
  flow through the policy-engine layer instead
