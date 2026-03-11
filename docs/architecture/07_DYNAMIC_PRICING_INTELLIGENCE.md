# Prompt 7: Dynamic Pricing Intelligence

## Executive Summary
This document specifies the Dynamic Pricing Intelligence engine, a core financial optimization system. It maximizes host revenue and platform liquidity (Prompt 2) by dynamically calculating near real-time pricing recommendations and automatic overrides based on complex exogenous and endogenous signals.

## 1. Intelligence Architecture

The Pricing Engine is fundamentally decoupled from the core Booking transaction flow (Prompt 1). It operates as an asynchronous calculation pipeline feeding a highly-available Pricing Cache.

1. **Pricing Signal Ingestion:** Collects structured streams for demand (Prompt 4), competitor scraping, calendar occupancy, and host-defined rules constraints.
2. **Calculation Pipeline (Apache Flink/Spark Streaming):** Applies machine learning models (e.g., Gradient Boosting or Deep Reinforcement Learning) to output point-in-time pricing modifiers.
3. **Pricing Rule & Modifier Cache (Redis/Memcached):** Stores the base price + an array of pre-calculated temporal modifiers (e.g., `+15% on 2026-12-31`).

## 2. Dynamic Pricing Models

The system evaluates three core models to formulate the final suggested price:

### A. Demand-Based Pricing (The Macro Signal)
Ingests the output from the Global Demand Forecasting System (Prompt 4). 
*   Identifies localized surges (e.g., an unannounced concert leading to a sudden spike in search volume in a specific H3 hexagon) and instantly scales the price multiplier.

### B. Competitive Intelligence (The Micro Signal)
Utilizes external scraping or third-party market data APIs (e.g., AirDNA) to map a host's property against similar Active properties within a geographic radius. 
*   If competitive inventory drops below a threshold (scarcity), the engine suggests a premium markup.

### C. Occupancy Optimization (The Host Signal)
Calculates the "Pacing" of a specific listing. If a host usually books 30 days in advance, but is currently 15 days out with no booking, the engine applies an aggressive discount multiplier (decay function) to stimulate utilization.

## 3. Pricing Rule Integration & Evaluation

When a Renter initiates a Search (Prompt 6) or queries a specific Listing API:

1.  **Strict Base Rate Retrieval:** Fetch the host-defined minimum floor and base rate.
2.  **Modifier Compilation:** Fetch all active modifiers (Demand, Seasonality, Length-of-Stay discount) from the Pricing Cache for that specific Listing ID for the requested date intersection.
3.  **Real-Time Math Execution:** Execute the formula `Base Rate * (1 + Modifier1 + Modifier2) = Final Nightly Rate`.
4.  **Tax & Fee Application (Prompt 12):** Send the final subtotal to the Global Tax Engine to calculate local levies before presenting the final price to the user.

---

## Architecture Observations
- Uses an **eventual consistency** model for the calculation of modifiers, but absolutely **strict consistency** when presenting the price to the user during checkout. Once a user enters the Checkout flow, the price is cryptographically signed and frozen in the `Financial Aggregate` for the duration of the payment intent.
- Hosts can opt-in to "Fully Automated Pricing" or merely receive suggestions in their dashboard.

## Extensibility Assessment
- **High:** The pipeline is a simple additive modifier system. Adding a new regional pricing strategy (e.g., a state-mandated discount for locals) involves injecting a new rule node that outputs a negative modifier if the user profile matches the criteria.

## Critical Findings
- **Severity: High** - **Pricing Runaway / Flash Crashes.** Erroneous demand signals could lead the ML model to suggest pricing a $100/night room at $5000/night or $1/night. The system strictly requires host-defined (or platform-default) Minimum Floors and Maximum Thresholds that physically cannot be overridden by the intelligence engine.
- **Severity: Critical** - Latency in the calculation path of the Modifier Compilation phase directly slows down the entire multi-modal search experience. Pre-computation is essential.