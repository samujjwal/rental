# Prompt 15: Dispute & Resolution Platform

## Executive Summary
This document outlines the Dispute & Resolution Platform. Operating a global marketplace fundamentally mandates handling bad actors, accidents, and broken agreements. This platform is a tightly-controlled state machine that manages the financial and reputational lifecycle of a dispute (e.g., property damage, cleanliness complaints, last-minute cancellations) from initiation through mediation to final financial settlement.

## 1. The Dispute State Machine

Unlike unstructured customer support tickets, a Dispute is a formal Domain Aggregate tied directly to a `BookingID` and tightly coupled with the Payment Orchestrator (Prompt 11).

### Core Transitions:
1.  **`DisputeOpened`:** Created manually by Host/Renter or automatically by the AI Concierge (Prompt 3). Triggers an immediate hold (freeze) on the pending Escrow payout associated with the Booking.
2.  **`EvidenceSubmitted`:** Both parties have a strict TTL (Time-To-Live, e.g., 72 hours) to upload photos, chat logs, and receipts.
3.  **`MediatorAssigned`:** The case routes to either the AI Concierge (Level 1) or a human Trust & Safety agent (Level 2).
4.  **`ResolutionIssued`:** A binding decision is generated specifying exact financial re-allocation (e.g., "Renter refunds Host $150 for damages").
5.  **`SettlementExecuted`:** The system commands the Payment Orchestrator to capture funds, issue partial refunds, or tap into the Platform's Insurance/Host Guarantee pool.

## 2. Integrated Evidence Gathering

*   **Computer Vision Integration:** Photos uploaded as evidence (`EvidenceSubmitted`) are automatically run through image forensics pipelines to detect EXIF metadata manipulation or recycling of old damage photos from previous disputes.
*   **Chat Logs as Immutable Ledger:** In-platform messaging cannot be deleted by users. The system automatically pulls the communication ledger as primary evidence.
*   **IoT & Telemetry Data:** For vertical-specific rentals (e.g., Car Rentals or High-End Smart Homes), automated API queries retrieve telemetry (Noise decibel sensors, telematics speed data) to corroborate or deny claims.

## 3. Mediation Tiers & Workflows

1. **Tier 1 - AI Mediated (Micro-Claims):** Low-value disputes (e.g., <$50 cleanliness complaint) where evidence strongly correlates with a localized penalty matrix. AI issues rapid micro-refunds from the platform's buffer to maintain user satisfaction.
2. **Tier 2 - Human Mediated (Damage & Harm):** Severe escalations require legal-compliant handling. Human mediators use specialized UI dashboards providing contextual summaries and Trust Scores (Prompt 14) of both parties.
3. **Tier 3 - Insurance Routing:** Claims exceeding platform caps (e.g., House Fire) are packaged as structured JSON payloads and digitally routed to third-party underwriting syndicates via B2B APIs.

---

## Architecture Observations
- Uses a rigid **Event-Sourced** architectural pattern. Every stage transition is an immutable event (`DisputeOpenedEvent`, `EvidenceAddedEvent`). This guarantees complete auditability in case of subsequent legal litigation.
- Designed to minimize "He-said She-said" deadlocks by pushing parties toward the AI Concierge for preliminary, guided de-escalation before freezing escrows.

## Extensibility Assessment
- **High:** The rules defining the TTLs, the categorization of damages, and the legal constraints are inherently controlled by the Country Policy Packs (Prompt 13). (e.g., EU rights stipulate different refund timelines than US laws).

## Critical Findings
- **Severity: Blocker** - **Escrow Desync.** If a Dispute triggers *after* the `Payout Execution` phase (Prompt 11) has fired a bank transfer command to the PSP, the platform cannot "claw back" the money easily. The system must issue secondary localized debt assertions (invoicing the guilty party or charging secondary cards on file).
- **Severity: High** - **Bot-driven Dispute Flooding.** Malicious actors could DDoS the platform by opening automated disputes on every booking to intentionally lock up competitor funds. Dispute initiation must be strictly rate-limited and subjected to Fraud Intelligence scoring (Prompt 8).