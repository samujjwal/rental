# Prompt 11: Global Payment Orchestration

## Executive Summary
This document outlines the Payment Orchestration platform. Handling billions in Gross Booking Value (GBV) across dozens of currencies requires decoupling core business logic from third-party Payment Service Providers (PSPs). This orchestration layer acts as a unified financial router executing authorizations, captures, escrows, and global payouts.

## 1. Provider Abstraction Interface

The system is constructed around the **Adapter / Strategy Pattern**. The core platform `BookingSaga` never directly invokes Stripe, Adyen, or PayPal. It communicates exclusively with a `PaymentIntent` Domain Aggregate.

### Core Interface Contract (`IPaymentProvider`):
*   `tokenize(paymentMethodData): Token`
*   `authorize(amount, currency, sourceToken): AuthID`
*   `capture(AuthID, amount): CaptureID`
*   `refund(CaptureID, amount, reason): RefundID`
*   `createEscrowAccount(HostIdentity): SubAccountID`
*   `disburse(SubAccountID, amount, currency): PayoutID`

## 2. Orchestration Architecture

*   **Payment Gateway Service:** The central routing engine. Based on the Renter's localization and the active Country Policy Pack (Prompt 13), it dynamically selects the lowest-latency, highest-success-rate, or cheapest PSP.
*   **Idempotency Layer:** Guaranteed exactly-once execution. Every financial request is wrapped with a unique `IdempotencyKey`. If a network timeout occurs during a `$10,000` capture, the system can safely retry the exact key without risking a double-charge.
*   **Immutable Core Ledger:** A double-entry accounting system tracking platform states. All movements (Wallet -> Escrow, Escrow -> Platform Fee, Escrow -> Host Payout) are strictly codified as balanced debits/credits in a dedicated Database (e.g., TigerBeetle or a protected Postgres schema).

## 3. The Financial Lifecycle (Escrow & Payouts)

Unlike standard e-commerce (immediate fulfillment), the Global Rental Platform relies heavily on deferred fulfillment (booking today for a stay 6 months from now).

1.  **Time of Booking (T=0):** Authorized & Captured. Funds are moved from the Renter into the Platform's **Master Escrow Account** (abstracted by a provider like Stripe Connect or Adyen for Platforms).
2.  **The Holding Period:** Funds sit in Escrow. Complex rules manage chargeback windows, cancellations, and FX (Foreign Exchange) rate locking.
3.  **Check-In (T=Stay):** Funds are conceptually released to the Host's virtual wallet but held pending any Immediate Disputes (Prompt 15) arriving within the first 24 hours.
4.  **Payout Execution (T=Stay + 24h):** The Orchestrator calculates Platform Fees, local Tax deductions (Prompt 12), and queues the net amount for mass disbursement to the Host's configured Bank Account via ACH / SEPA / SWIFT / UPI.

---

## Architecture Observations
- Relies heavily on **Webhook ingestion** for asynchronous state changes (e.g., async bank transfers or SEPA delays). Webhooks from PSPs are pushed onto a Kafka queue for resilient, unordered processing.
- The system must remain strongly PCI-DSS compliant. Full Primary Account Numbers (PANs) never touch the platform's infrastructure; they are tokenized directly at the client (browser/mobile) via Provider iFrames.

## Extensibility Assessment
- **Very High:** Launching in a new region (e.g., Bangladesh) that requires a specific local PSP (e.g., bKash / SSLCommerz) only requires writing a single new Adapter class that conforms to the `IPaymentProvider` interface and registering it in the Bangladesh Policy Pack. The core Checkout code remains 100% untouched.

## Critical Findings
- **Severity: Blocker** - **Floating Point Arithmetic Errors.** Under no circumstances should `flots` or `doubles` be used for financial calculations due to precision loss. All financial values in the system *must* be stored and transmitted as `integer` micro-denominations (e.g., cents, pisa) paired with an ISO-4217 Currency Code string (e.g., `amount: 1050, currency: 'USD'` = $10.50).
- **Severity: High** - **FX Exposure limits.** Cross-currency bookings (e.g., booking in GBP but payout in THB) can incur massive platform losses if FX markets move sharply between Capture and Payout. The Orchestration engine must explicitly pass FX Risk to the PSP or Host via dynamic conversion at the time of payout.