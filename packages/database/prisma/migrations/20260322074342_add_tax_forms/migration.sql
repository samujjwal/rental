-- CreateTable
CREATE TABLE "tax_forms" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "formData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_store" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_snapshots" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "promptId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_forms_userId_year_idx" ON "tax_forms"("userId", "year");

-- CreateIndex
CREATE INDEX "event_store_aggregateId_version_idx" ON "event_store"("aggregateId", "version");

-- CreateIndex
CREATE INDEX "event_store_aggregateId_aggregateType_idx" ON "event_store"("aggregateId", "aggregateType");

-- CreateIndex
CREATE INDEX "event_store_eventType_timestamp_idx" ON "event_store"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "event_store_timestamp_idx" ON "event_store"("timestamp");

-- CreateIndex
CREATE INDEX "event_snapshots_aggregateId_version_idx" ON "event_snapshots"("aggregateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "event_snapshots_aggregateId_version_key" ON "event_snapshots"("aggregateId", "version");

-- CreateIndex
CREATE INDEX "ai_usage_ledger_userId_createdAt_idx" ON "ai_usage_ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_ledger_organizationId_createdAt_idx" ON "ai_usage_ledger"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_ledger_promptId_createdAt_idx" ON "ai_usage_ledger"("promptId", "createdAt");

-- AddForeignKey
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
