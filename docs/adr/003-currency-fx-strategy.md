# ADR-003: Currency and FX Strategy

**Status:** Accepted  
**Date:** 2026-02-22  

## Context
The platform operates globally with multi-currency needs. Currently, currency fields exist on listings and bookings, but no FX snapshot is captured during pricing/checkout, making financial auditing unreliable.

## Decision
1. Introduce `FxRateSnapshot` model to capture exchange rates at quote/checkout time.
2. Four currency contexts:
   - **Listing currency**: set by owner.
   - **Booking transaction currency**: currency of the payment.
   - **Display currency**: viewer preference (conversion for display only).
   - **Settlement currency**: owner payout currency.
3. Every booking quote and checkout event records an FxRateSnapshot.
4. All financial totals reference the snapshot used for conversion.

## Consequences
- Financial auditing is deterministic and traceable.
- Currency conversions can be replayed from stored snapshots.
- Payouts maintain settlement currency integrity.
