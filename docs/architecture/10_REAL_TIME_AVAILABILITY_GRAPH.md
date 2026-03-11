# Prompt 10: Real-Time Availability Graph

## Executive Summary
This document outlines the Real-Time Availability Graph. Unlike the static or slowly-changing catalog properties (description, images), availability is highly volatile. This system is designed specifically to solve the "double-booking" problem across a globally distributed platform under extreme concurrency (e.g., hundreds of users trying to book the same New Year's Eve cabin simultaneously), ensuring sub-second response times for search filtering and absolute strict consistency during checkout.

## 1. Availability Architecture

The core relational database (Prompt 1) is too slow for high-throughput availability filtering across millions of listings. Therefore, the architectural relies on a dedicated, highly optimized in-memory subsystem.

1. **Source of Truth (RDBMS):** The primary PostgreSQL DB stores the canonical `Reservation` aggregates.
2. **The Availability Cache (Redis / specialized Interval Tree DB):** An in-memory data grid mapping `InventoryUnitID` to an Interval Tree or highly compressed Bitmap representing time blocks.
3. **Availability Microservice (Go or Rust):** A hyper-optimized service exposing two main actions:
    *   **Bulk Query (Reads):** "Given these 1000 Candidate Listing IDs (from Search - Prompt 6), which ones are available from strictly Dec 20 to Dec 25?"
    *   **Mutate (Writes/Locks):** "Acquire a lock on `InventoryUnit_A` from Dec 20 to Dec 25 for User X."

## 2. Concurrency Control & Overlap Prevention

To prevent overlaps (double-bookings), the system relies on strict concurrency control mechanisms during the Booking Saga (Prompt 1).

### The Locking Flow:
1.  **Intent to Book:** When a user proceeds to Checkout, the Availability Microservice attempts a distributed lock on the precise date range for the target `InventoryUnitID`.
2.  **Short-Lived Lock (TTL = 10 mins):** If the interval is free, a temporary block (Soft Lock) is placed in Redis. If the interval intersects with *any* existing block (Hard or Soft), the request fails instantly, returning a `ConcurrenyException` to the UI.
3.  **Payment Orchestration (Prompt 11):** The user has 10 minutes to complete the complex payment and KYC verification flows.
4.  **Commit (Hard Lock):** Upon successful payment, the booking service commits the `Reservation` into PostgreSQL and updates the Redis interval tree to a permanent `Hard Lock`.
5.  **Rollback:** If payment fails or TTL expires, the `Soft Lock` evaporates, instantly freeing the inventory in Search.

## 3. Multi-Unit Reservations Support

The Graph inherently models fractional or multi-unit rentals (e.g., a Boutique Hotel with 5 identical standard rooms mapped to 1 Listing).
*   **Capacity Mapping:** Instead of a boolean (Available/Not Available), a Listing maps to a `ResourcePool`.
*   **Decrementing Locks:** A reservation drops the `AvailableCount` for that interval from 5 -> 4. Only when `AvailableCount == 0` is the `Listing` completely hidden from multi-modal Search.

---

## Architecture Observations
- Uses **Strict Consistency**. Eventual consistency is a catastrophic failure mode in inventory management. The Redis lock check must be performed atomically (via Lua scripts) to guarantee safety.
- **Pre-allocation mapping:** The date ranges are typically abstracted into finite slots (e.g., midnight-to-midnight slots) stored effectively as `Bitsets/Bitmaps` in memory (e.g., bit 1 = Day 1 of the year). Checking a 5-day availability is a simple Bitwise `AND` operation resulting in $O(1)$ time complexity for thousands of listings.

## Extensibility Assessment
- **Medium:** Modifying the temporal boundaries (e.g., moving from daily rentals to hourly rentals like Turo or hourly meeting spaces) forces a complete restructure of the underlying Bitset/Interval tree sizing. The schema must support varying `TimeResolution` blocks at the `InventoryUnit` level.

## Critical Findings
- **Severity: Blocker** - **Clock Drift in Distributed Systems.** If relying purely on Redis TTL expirations across multiple global data centers, clock drift could cause a lock to release prematurely. The Checkout Orchestrator must actively refresh the lock heartbeat via the Saga pattern until payment fully settles.
- **Severity: High** - **Cache Rehydration.** If the Redis cluster crashes, an immediate cold boot must repopulate the entire interval tree from the PostgreSQL `Reservations` table before any Search traffic is permitted, lest double-bookings occur during the outage window.