-- ============================================================
-- Migration: audit_fixes_g9_g11
-- Date: 2026-03-16
-- Purpose:
--   G9  – Explicit onDelete behaviors on Booking foreign keys
--          Financial records: RESTRICT (prevent accidental booking hard-delete)
--          Audit / nullable records: SET NULL (preserve for accounting)
--   G11 – Booking date-overlap exclusion constraint at DB level
--          Prevents duplicate bookings even if application-level locks fail
-- ============================================================

-- Enable btree_gist extension needed for the EXCLUDE constraint (G11)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ──────────────────────────────────────────────────────────────
-- G9: payments — Restrict (financial record, must not orphan)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_bookingId_fkey";
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: refunds — Restrict
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "refunds_bookingId_fkey";
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: deposit_holds — Restrict
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "deposit_holds" DROP CONSTRAINT IF EXISTS "deposit_holds_bookingId_fkey";
ALTER TABLE "deposit_holds"
  ADD CONSTRAINT "deposit_holds_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: ledger_entries — SetNull (accounting record, nullable FK)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "ledger_entries_bookingId_fkey";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: reviews — SetNull (review must survive if booking is deleted)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_bookingId_fkey";
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: insurance_policies — SetNull (regulatory record, nullable FK)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "insurance_policies" DROP CONSTRAINT IF EXISTS "insurance_policies_bookingId_fkey";
ALTER TABLE "insurance_policies"
  ADD CONSTRAINT "insurance_policies_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G9: insurance_claims — SetNull (regulatory record, nullable FK)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "insurance_claims" DROP CONSTRAINT IF EXISTS "insurance_claims_bookingId_fkey";
ALTER TABLE "insurance_claims"
  ADD CONSTRAINT "insurance_claims_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- G11: No-overlap exclusion constraint on active bookings
-- Prevents DB-level double-booking even if application locks miss.
-- Uses gist index on (listingId, daterange) so it's efficient.
-- Excludes terminal states (CANCELLED, PAYMENT_FAILED, REFUNDED)
-- to avoid blocking retries on cancelled bookings.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_date_overlap"
  EXCLUDE USING gist (
    "listingId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE (
    status NOT IN ('CANCELLED', 'PAYMENT_FAILED', 'REFUNDED', 'SETTLED')
  );
