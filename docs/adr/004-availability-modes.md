# ADR-004: Availability Mode Strategy

**Status:** Accepted  
**Date:** 2026-02-22  

## Context
Different rental categories require different availability models. Houses need date-range blocking, vehicles need pickup/return slot constraints, and clothing needs per-size inventory tracking. Currently, only date-range availability exists.

## Decision
1. Introduce three availability modes: `DATE_RANGE`, `TIME_SLOT`, `INVENTORY`.
2. Introduce `AvailabilitySlot` model for slot-based availability.
3. Introduce `InventoryUnit` model for variant/size-aware inventory.
4. Availability service uses strategy pattern to delegate to mode-specific logic.
5. Category determines default availability mode.

## Consequences
- Each category can use the most appropriate availability model.
- Concurrent booking conflict detection is mode-aware.
- Backward-compatible: existing `Availability` model continues to support `DATE_RANGE`.
