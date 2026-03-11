-- Migration: add_booking_archived_at_and_slot_version
-- Adds:
--   1. bookings.archived_at  — soft-delete tombstone to preserve FK references
--   2. availability_slots.version — optimistic-lock counter to prevent double-booking races

-- 1. Soft-delete field on bookings
ALTER TABLE "bookings" ADD COLUMN "archived_at" TIMESTAMP(3);

-- Index speeds up "show only non-archived" WHERE clauses
CREATE INDEX "bookings_archived_at_idx" ON "bookings"("archived_at");

-- 2. Optimistic-lock version counter on availability_slots
ALTER TABLE "availability_slots" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
