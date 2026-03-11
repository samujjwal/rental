# Prompt 5: Autonomous Expansion Planner

## Executive Summary
This document designs the fully automated, data-driven Expansion Planner system. Operating independently of manual strategic oversight, it evaluates global readiness for hyper-local or national expansion. By synthesizing operational, regulatory, and infrastructural signals, the Planner dynamically scores new markets, generates the necessary configuration packages (Policy Packs), and manages the rollout lifecycle.

## 1. Automated Expansion Core

The Autonomous Expansion Planner operates as a sophisticated rules engine and orchestration layer (e.g., orchestrated via Temporal or Airflow), continuously evaluating potential new regions and generating readiness scores out of 100 before recommending automated deployment pipelines.

## 2. Market Opportunity Analysis

The top of the funnel represents global demand signals evaluated globally by the Forecasting System (Prompt 4):

*   **Latent Demand Scanning:** Tracks "Zero-Result Searches" for unavailable geographical areas (e.g., "Ski Chalet in Niseko, Japan" when Japan is inactive).
*   **Shadow Inventory Profiling:** Aggregates public data (e.g., scraped competitive listings or public real estate/vehicle density APIs) to estimate the Total Addressable Market (TAM).
*   **Economic Viability:** Estimates Average Daily Rates (ADR) and expected platform adoption velocity.

## 3. The Readiness Evaluation Pipeline

When a region exceeds the Opportunity Threshold, the system initiates four parallel assessments:

### A. Regulatory Readiness Evaluation:
Validates the feasibility against the enterprise Compliance Engine (Prompt 18) and Tax Engine (Prompt 12):
*   **Tax Jurisdiction Mapping:** Can the platform automatically source the correct VAT/GST policies via the Tax Plugin?
*   **KYC/AML Data Availability:** Are there accessible Identity Verification vendors (e.g., Onfido, Stripe Identity) covering the target nationality?
*   **Local Ordinance Parsing:** Scans (potentially via LLM-assisted tools) municipal regulatory APIs for Short-Term Rental sub-laws or bans.

### B. Infrastructure Availability Checks:
*   **Payment Gateway Coverage:** Confirms local currency support, payout capabilities (Stripe Connect/Adyen availability), and necessary banking primitives.
*   **Cloud Latency:** Tests geographic proximity to active edge POPs or multi-region data centers (Prompt 17) to ensure P99 response times.

### C. Localization Readiness Scoring:
*   **Linguistic Coverage:** Confirms the UI, Email Templates, AI Concierge datasets, and Trust & Safety models support the primary and secondary regional languages.
*   **Formatting Compliance:** Adjusts the Policy Engine rules for local phone numbers, addresses, date formats, and currency rounding rules.

## 4. The Automated Rollout Pipeline

If the aggregate Readiness Score > 90/100, the Planner automatically transitions to the Rollout Phase:

### The "Zero-Touch" Deployment Flow:

1.  **Drafting the Country Policy Pack (Prompt 13):**
    *   The Planner automatically generates the JSON/YAML configuration defining exact overrides for taxation rules, identity requirements, and supported payment methods.
2.  **Simulation Execution (Prompt 19):**
    *   Initiates an integration test utilizing synthetic data to validate end-to-end booking flow strictly using the new configuration pack.
3.  **Liquidity Engine Seeding (Prompt 2):**
    *   Issues API commands to marketing/growth tools (e.g., automatically launching targeted FB/Google Ads) to acquire the "Seed Supply" (the first 100 hosts).
4.  **Phased Beta Activation:**
    *   The region is transitioned from "Inactive" to "Beta-Only" (only specific whitelisted hosts/renters can interact).
    *   Data points are streamed directly into the Global Observability System (Prompt 16) specifically tagged for anomaly detection in the new region.
5.  **General Availability (GA):**
    *   Upon passing predetermined volume and error rate metrics, the market flag organically transitions to fully active globally.

---

## Architecture Observations
- Relies heavily on **configuration as code** and **policy-driven enablement**. Because core business logic (Prompt 1) is entirely abstracted from regional behavior, the rollout is fundamentally just an injection of new JSON/YAML data.
- The use of Temporal/Step Functions is critical, as a complete analysis cycle (especially involving human-in-the-loop regulatory checks) might span weeks.

## Extensibility Assessment
- **High:** The Readiness Evaluation Pipeline is highly modular. If a new, highly restrictive regulation appears globally (e.g., a new GDPR equivalent), an evaluation plugin can be instantly slotted into all future market checks.
- Changes in provider API support (e.g., Stripe opening up in a new country) automatically trigger re-evaluations via scheduled event loops.

## Critical Findings
- **Severity: Blocker** - The framework fundamentally relies on the accuracy of the Country Policy Pack Framework. An automated rollout pushing a malformed policy (e.g., setting the wrong tax calculation formula) could incur massive financial liabilities. A human-in-the-loop audit strictly gating Stage 4 (Beta Activation) is essential for Enterprise-grade deployments.
- **Severity: High** - Lack of historical data in a newly opened market initially neutralizes the effectiveness of the AI Demand Forecaster and Pricing Intelligence. The system must initialize newly opened regions using proxy historical data from demographically similar regions.