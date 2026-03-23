-- CreateTable
CREATE TABLE "tax_calculations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "listingId" TEXT,
    "stripeTaxId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "jurisdiction" TEXT,
    "taxBreakdown" JSONB NOT NULL DEFAULT '[]',
    "customerAddress" JSONB,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_calculations_bookingId_idx" ON "tax_calculations"("bookingId");

-- CreateIndex
CREATE INDEX "tax_calculations_listingId_idx" ON "tax_calculations"("listingId");

-- CreateIndex
CREATE INDEX "tax_calculations_createdAt_idx" ON "tax_calculations"("createdAt");
