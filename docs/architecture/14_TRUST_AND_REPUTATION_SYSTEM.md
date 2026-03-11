# Prompt 14: Trust, Reputation & Moderation

## Executive Summary
This document specifies the Trust, Reputation, and Moderation platform. A marketplace cannot function solely on dynamic pricing or search; converting strangers into transactional actors requires an explicit, highly visible Trust network. This system continuously calculates a floating mathematical signature (Trust Score) for every user while enforcing manual and automated operational moderation guardrails.

## 1. Dynamic Reputation Model

Unlike a static 1-5 star review score, the Enterprise Platform utilizes a multi-dimensional, decaying Trust Model calculated asynchronously to generate the `PlatformTrustScore` (0-1000).

### Core Signals (Weighted Ingestion)
*   **Bidirectional Review Vectors:** Length of the review context, tone analysis via NLP, star rating (weighted heavily towards recent interactions to avoid grandfathered behavior anomalies).
*   **Operational Reliability:** 
    *   *Cancellation Velocity:* The ratio of bookings a Host cancels post-confirmation vs fulfills.
    *   *Message Response Time:* The P90 latency between Host and Renter messages.
*   **Dispute Frequency (Prompt 15):** Being a party to a mediated dispute drastically impacts the score, with the final adjustment determined by the resolution ruling (At-Fault vs Not-At-Fault).
*   **Identity Completion (KYC):** Passing higher tiers of the Country Policy Pack verification stages (e.g., verifying a Government ID vs just verifying an Email) acts as base floor modifiers.

### Scoring Pipeline
The system utilizes a stream-processor (e.g., Kafka Streams) computing moving averages. If a Host cancels a booking, an event is emitted, drastically reducing their Trust Score in near real-time, instantly lowering their visibility in the Search Ranking (Prompt 6).

## 2. Moderation & Enforcement Workflow

The platform maintains safety via three escalation paths:

### A. Pre-Emptive Automated Guardrails (AI Moderation)
*   **Content Scanning:** Renter-Host messaging, Listing photos (Computer Vision), and Listing titles are scanned asynchronously upon creation/modification. Violations of PII exposure (attempting to share phone numbers to bypass platform fees) or prohibited imagery automatically trigger Listing Suspensions before human view.

### B. Reactive Flagging (Community Reports)
*   Users can flag Listings or Messages. These inputs are aggregated. If a threshold of independent unique flags happens within a localized temporal window (e.g., 5 flags in 1 hour on a high-value listing), the system triggers an emergency Circuit Breaker (pausing availability).

### C. The Moderation Workbench
A centralized Operations UI. High-risk actions flowing from the Fraud Engine (Prompt 8) or Trust Engine are queued for specialized teams.
*   **Actions:** `Shadowban` (Listing exists but cannot be found in Search), `Force Verifications`, `Deactivate Host Account` (automatically migrating all pending bookings to an immediate cancellation and refund API flow).

## 3. The Re-education Path

Bans are not purely terminal. A low Trust Score dynamically throttles specific features via the domain models (Prompt 1).
*   e.g., A Host dropping below a 400 Trust Score loses access to "Instant Book" completely, forcing all potential Renters to send manual requests, adding heavy friction as a penalty constraint. Over time, fulfillment of manual bookings without incident allows the score to naturally restore and unlock the feature again.

---

## Architecture Observations
- Uses **Graph propagation** (Prompt 9 integration). Banning a Host triggers a sub-routine that cascades the Trust Penalty to logically linked Co-Hosts to prevent them simply spinning up identical inventory on an alternate shadow account.
- Relies heavily on **Shadow State Enforcement**. Shadow-banning stops automated bot scrapers from knowing they've been detected.

## Extensibility Assessment
- **Medium:** Implementing massive changes to the Reputation formula must be back-tested against historical data via offline clusters before deployment, to ensure a well-meaning tweak doesn't inadvertently suspend 20% of the active Host supply overnight.

## Critical Findings
- **Severity: High** - **Algorithmic Bias in NLP Moderation.** Overly stringent text/image parsing models might unevenly flag certain cultural aesthetics, linguistic patterns, or localized slang dictated by Regional rollouts. Moderation rules must be cross-referenced against the active Country Pack locale definitions to mitigate severe community push-back.
- **Severity: High** - **Extortion Economics.** Allowing Review Scores to rigidly gate payouts (e.g., unlocking funds only if 5-stars are left) encourages massive platform extortion. Reviews must always be Double-Blind and simultaneous (neither party sees the other's review until both are submitted or the TTL window closes).