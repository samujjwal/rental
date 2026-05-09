-- Create quote_snapshots table for persistent pricing calculations
CREATE TABLE IF NOT EXISTS "quote_snapshots" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "base_price" DECIMAL(10,2) NOT NULL,
  "duration" INTEGER NOT NULL,
  "duration_type" TEXT NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "platform_fee" DECIMAL(10,2) NOT NULL,
  "service_fee" DECIMAL(10,2) NOT NULL,
  "taxes" DECIMAL(10,2) NOT NULL,
  "deposit_amount" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "owner_earnings" DECIMAL(10,2) NOT NULL,
  "breakdown" JSONB NOT NULL,
  "tax_lines" JSONB NOT NULL,
  "discount_breakdown" JSONB,
  "pricing_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),

  CONSTRAINT "quote_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_quote_snapshots_booking_id" ON "quote_snapshots"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_quote_snapshots_user_id" ON "quote_snapshots"("user_id");
CREATE INDEX IF NOT EXISTS "idx_quote_snapshots_listing_id" ON "quote_snapshots"("listing_id");
CREATE INDEX IF NOT EXISTS "idx_quote_snapshots_expires_at" ON "quote_snapshots"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_quote_snapshots_created_at" ON "quote_snapshots"("created_at");

-- Add comment
COMMENT ON TABLE "quote_snapshots" IS 'Persistent quote snapshots for pricing calculations used through checkout, invoice, refund, payout, and ledger';
