-- Create booking_outbox table for durable side effect processing
CREATE TABLE IF NOT EXISTS "booking_outbox" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),

  CONSTRAINT "booking_outbox_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient processing
CREATE INDEX IF NOT EXISTS "idx_booking_outbox_booking_id" ON "booking_outbox"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_booking_outbox_status" ON "booking_outbox"("status");
CREATE INDEX IF NOT EXISTS "idx_booking_outbox_created_at" ON "booking_outbox"("created_at");
CREATE INDEX IF NOT EXISTS "idx_booking_outbox_status_created_at" ON "booking_outbox"("status", "created_at");

-- Add comment
COMMENT ON TABLE "booking_outbox" IS 'Durable outbox for booking state transition side effects to ensure exactly-once processing';
