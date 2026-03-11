# Prompt 2: Marketplace Liquidity Engine

## Executive Summary
This document defines the highly-available, event-driven Liquidity Engine designed to ensure marketplace health out to global scale. It continuously balances supply (hosts, listings, available inventory) with demand (renters, search volume, booking intent). The engine sits atop the core Domain Model (Prompt 1) and utilizes signals to shape platform behavior without manually embedding regional business logic.

## 1. Engine Core & Components

The Liquidity Engine acts as the central brain orchestrating the growth and health of the global platform. It is composed of three core modules:

1. **Supply-Demand Balancing Component:** Aggregates real-time localized data on active supply and searching/booking users.
2. **Host Activation Strategy Component:** Ingests un-activated listing data (e.g., drafted or dormant) to trigger incentives for market activation.
3. **Demand Shaping Mechanism Component:** Manipulates visibility, pricing recommendations, and marketing spend channels (like SEM APIs) based on utilization metrics.

## 2. Market State & Metrics

The Engine continuously evaluates "Markets" (dynamic geographical and vertical subsets) based on metrics:

*   **Market Saturation Index (MSI):** Ratio of search intents (user queries) to available, bookable Inventory Units over a given time horizon. 
    *   *High MSI (Demand > Supply):* Triggers supply acquisition algorithms.
    *   *Low MSI (Supply > Demand):* Triggers demand shaping (discounts/promotion) algorithms.
*   **Host Activation Rate (HAR):** Speed at which an onboarding Host moves from `Sign-Up` to `First Booking Confirmed`.
*   **Inventory Utilization Optimization (IUO):** Percentage of a given list's availability window that contains confirmed reservations vs. idle time.

## 3. Supply-Demand Balancing Algorithms

The algorithms function over an event-streaming backbone (Apache Kafka / AWS Kinesis):

### Algorithm #1: Supply Density Trigger
When `MSI` exceeds a predefined threshold (e.g., 20 searches per 1 available property on a weekend in Berlin):
1.  **Host Activation:** Automatically dispatch email/SMS hooks to dormant hosts in the matching bounding box offering a temporary negative comission (host bonus) to list availability.
2.  **Pricing Intelligence Signal:** Sends a surge multiplier to the Dynamic Pricing Intelligence engine (Prompt 7) to automatically adjust suggested pricing for active hosts upwards.
3.  **Expansion Planner Hook:** Logs a data point for the Autonomous Expansion Planner (Prompt 5).

### Algorithm #2: Demand Shaping Flow
When `IUO` drops globally for a specific vertical (e.g., Luxury Cars in Winter):
1.  **AI Concierge Rerouting:** Instructs the AI Concierge System (Prompt 3) to rank these listings higher in conversational Discovery modes.
2.  **Merchandising/Discount Generation:** Automatically flashes a temporary localized discount via Regional Policy Packs rules.
3.  **Search Ranking Penalty/Boost:** Alters Elasticsearch/vector weights to prioritize low-utilization areas.

## 4. Architecture Implementation

*   **Data Ingestion:** Real-time stream processing via Flink or Spark.
*   **Storage:** Fast real-time OLAP (e.g., ClickHouse or Apache Pinot) to rapidly query sliding windows of MSI and HAR metrics.
*   **Action Dispatcher:** An orchestration service (e.g., Temporal or AWS Step Functions) that safely triggers the side-effects (marketing, pricing algorithms) ensuring idempotency.

---

## Architecture Observations
- Relies heavily on decoupling core transactional state (Booking, Searching) from analytical state. The transaction database is purely a publisher to the Liquidity Engine via Change Data Capture (CDC).
- Market definition is dynamic: "Market" isn't strictly encoded as a geopolitical border but defined dynamically using S2 Geometry cells (H3 indexes).

## Extensibility Assessment
- **High:** New balancing algorithms and heuristics can be onboarded into the stream processor without impacting the core platform's latency. We can test specialized liquidity strategies (like B2B vs B2C) by registering new consumers to the Kafka topics.

## Critical Findings
- **Severity: High** - Action Idempotency. An error in the Demand Shaping mechanism could result in multiple discount codes or conflicting AI routing instructions being triggered simultaneously. The action dispatcher must maintain strict lock states on Market actions.
- **Severity: Medium** - Data lag between the live DB and the OLAP store could result in the Liquidity Engine acting on stale data, potentially promoting assets that just got booked. Near-zero latency CDC is a hard requirement.