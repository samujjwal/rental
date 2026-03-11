# Prompt 8: Fraud Intelligence Platform

## Executive Summary
This document specifies the enterprise-grade Fraud Intelligence Platform. As a high-velocity, low-latency rules and ML scoring engine, its function is the continuous, real-time evaluation of all user interactions (sign-ups, searches, bookings, payments, payouts) to intercept malicious activity before financial loss or physical harm occurs.

## 1. Intelligence Pipeline Architecture

The platform fundamentally operates as a highly available, synchronous intercept layer during critical transactions, coupled with an asynchronous stream-processing pipeline for complex behavioral analysis.

### The Real-Time Scoring Engine
When an event (e.g., `BookingInitiated`, `PaymentMethodAdded`) transpires:
1.  **Ingestion:** The event is synchronously passed to the Fraud Service.
2.  **Signal Enrichment (Feature Store):** Queries the user's historical state, connected accounts, and recent velocity metrics (e.g., "Has this user attempted 5 cards in the last hour?").
3.  **Deterministic Rules Engine:** Executes hard blocks (e.g., matching a known blocked IP or a user on an OFAC sanctions list).
4.  **ML Model Inference:** The event stream is fed into a Random Forest or XGBoost model trained on historical fraud vectors to generate a **Risk Score (0-100)**.
5.  **Decision Policy Execution:** Based on the Risk Score and the transaction context (e.g., a $10,000 mansion vs a $50 shared room), the engine outputs a decision: `ALLOW`, `CHALLENGE` (trigger MFA/KYC), or `DENY`.

## 2. Fraud Signals & Vectors

The intelligence models heavily rely on multi-dimensional signal aggregation:

### A. Behavioral & Device Intelligence
*   **Device Fingerprinting:** Integrates third-party SDKs (e.g., FingerprintJS, Sift) to track hardware IDs, browser configurations, and Tor/VPN exit node usage.
*   **Session Anomalies:** Detects abnormal navigation patterns (e.g., a user instantly booking a high-value listing without spending any time reading the description or viewing photos).

### B. Payment & Financial Risk Signals
*   **Card Agnostic Velocity:** Rapidly testing multiple credit cards (Carding) or issuing chargebacks across disparate linked accounts.
*   **Geographic Payment Anomalies:** Identifies when a card issued in the US is being used from a Russian IP to instantly book an apartment in Paris.
*   **Payout Risk:** Flagging hosts rapidly changing their bank routing information immediately prior to a large payout disbursement (Account Takeover).

### C. Network Graph Analysis (Prompt 9 Integration)
*   **Collusion Rings:** Queries the Global Inventory Graph to detect circular behavior (e.g., Host A continuously booking Host B's property, and Host B booking Host A's property, to artificially inflate review scores or launder money).

## 3. Operations & Resolution

*   **Risk Analysts Dashboard:** Flagged entities (`CHALLENGE` state) are routed to specialized human Trust & Safety analysts. A consolidated view of the user's entity graph, device history, and localized Policy Engine violations is presented.
*   **Feedback Loops:** A disputed chargeback or a human-verified false positive is automatically fed back into the Feature Store to train the next iteration of the ML models.

---

## Architecture Observations
- Employs a **shadow scoring** strategy. New fraud models are deployed in "shadow mode" where they score transactions but do not block them, allowing analysts to tune precision vs. recall before enforcing actual decisions.
- Strictly decoupled from the core Booking Aggregate to ensure that a failure in the Fraud API fails open (or closed, depending on the severity of the transaction tier) rather than crashing the core platform.

## Extensibility Assessment
- **High:** The rules engine is completely configuration-driven. Implementing a new localized fraud rule (e.g., requiring secondary identification for last-minute New Year's Eve bookings in London) takes only minutes via the Regional Policy Packs.

## Critical Findings
- **Severity: Blocker** - **Latency Tolerance.** The synchronous intercept during Checkout must return a decision in <200ms. Lengthy ML inferences must be relegated to async paths (`Post-Booking Review`) if they jeopardize checkout conversion rates.
- **Severity: High** - **False Positives.** An overly aggressive model instantly denying legitimate high-value cross-border bookings destroys the core utility (and revenue) of a global platform. The system heavily relies on `CHALLENGE` states (SMS, ID upload) rather than outright `DENY` states to manage this risk.