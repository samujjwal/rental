-- Create idempotency_records table for durable idempotency
CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "user_id" TEXT,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "body_hash" TEXT NOT NULL,
  "response" JSONB,
  "status_code" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),

  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_key_route_method" ON "idempotency_records"("key", "route", "method");
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_user_id" ON "idempotency_records"("user_id");
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_expires_at" ON "idempotency_records"("expires_at");

-- Add comment
COMMENT ON TABLE "idempotency_records" IS 'Durable idempotency records for API requests with request fingerprinting';
