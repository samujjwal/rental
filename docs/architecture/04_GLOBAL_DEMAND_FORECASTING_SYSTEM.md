# Prompt 4: Global Demand Forecasting System

## Executive Summary
This document delineates the architecture for the Global Demand Forecasting System, a mission-critical ML pipeline that leverages massive troves of historical, operational, and exogenous datastreams. Its objective is the accurate prediction of localized, short-to-medium-term rental demand, directly powering liquidity mapping (Prompt 2), dynamic pricing intelligence (Prompt 7), and proactive host activation.

## 1. Forecasting Architecture

The Forecasting System fundamentally operates as an offline and near-real-time training and inference loop, outputting predictive surfaces (e.g., demand heatmaps and pricing curves) distributed globally via Edge caches.

The system relies on a hybrid architectural model leveraging both **Time-Series Forecasting (e.g., Prophet, ARIMA, LSTMs)** for macroscopic trends and **Gradient Boosted Trees (XGBoost, LightGBM)** for localized, feature-rich episodic demand prediction (e.g., specific events or holidays).

## 2. Feature Pipeline Architecture

A robust, scalable Feature Store (e.g., Feast or Hopsworks) is fundamental for ensuring model consistency globally. The pipeline ingests multi-modal data streams to construct the feature vectors:

### Core Signal Ingestion:
1.  **Platform Engagement Streams (High Velocity):**
    *   **Search Volume:** Granularly tracked by coordinate bounding boxes, timestamps, and filter combinations (e.g., "Surge in searches for 'pet-friendly' in Kyoto during cherry blossom estimates").
    *   **Listing View Velocity:** The rate of user interactions (clicks, favorites) per available listing in a region.
2.  **Transactional Streams (Medium Velocity):**
    *   **Historical Booking Patterns:** Lead times, average length of stay (ALOS), cancellation rates by season, user demographics, and pricing tiers.
    *   **Booking Pacing:** The rate at which current forward-looking inventory is being booked compared to historical averages for the same timeframe.
3.  **Exogenous Data Ingestion (Low Velocity / Periodic):**
    *   **Event Signals:** APIs aggregating major sports events, concerts, conferences, and localized holidays derived from the Regional Policy Packs (Prompt 13).
    *   **Macro-Economic/Travel Patterns:** Flight capacity into regional airports, local weather forecasts, and currency fluctuation indices.

### Feature Processing Engine:
Raw signals are processed asynchronously (e.g., Apache Spark via Databricks or AWS EMR). Data is aggregated, normalized temporally and spatially using H3 Hexagons or S2 Geometry for consistent regional analysis irrespective of arbitrary borders.

## 3. Forecasting Models & Deployment Workflow

### The Demand Model Structure
The forecasting pipeline generates layered predictions:
*   **Macro Level (City/State):** 30/60/90-day baseline demand volume predictions.
*   **Micro Level (Neighborhood/Hexagon):** 7/14-day hyper-localized demand spike predictions.
*   **Vertical Level:** Differentiated forecasting by rental type (e.g., predicting surge for SUVs vs Economy cars during a winter storm).

### Deployment Architecture
1.  **Model Training & Registry (MLflow/SageMaker):** Managed lifecycle of model versions, A/B testing, and validation against historical hold-out sets. Models are retrained weekly or dynamically re-calibrated upon significant drift detection.
2.  **Batch Inference Pipeline:** Nightly processing jobs recalculate global demand surfaces for the next 1-365 days.
3.  **Prediction Distribution (Redis/Memcached):** Resultant forecast vectors are pushed to high-throughput, low-latency in-memory data grids.
4.  **Real-Time Serving API:** A microservice serving pre-computed forecasts (and occasionally running lightweight inference on the edge for immediate context adjustments) directly to the Dynamic Pricing Engine (Prompt 7) and Liquidity Engine (Prompt 2).

---

## Architecture Observations
- Relies heavily on **spatial indexing (H3/S2)** over traditional geographic borders. A market is defined by demand density curves rather than strict city limits.
- Forecasting is strongly decoupled from the transactional datastores. It reads from massive Data Lakes (S3/GCS with Parquet/Iceberg formats) populated via Change Data Capture (CDC).
- The use of a central Feature Store is vital to ensure that offline training and online inference utilize the exact same calculation logic for complex metrics like "Booking Pacing".

## Extensibility Assessment
- **High:** The architecture inherently supports the continuous addition of new external signal sources (e.g., a new global flight tracking API) via independent ingestion DAGs without disrupting existing models.

## Critical Findings
- **Severity: High** - **Data Leakage in Training.** Inadvertently including future state information (e.g., an early booking confirmed later) in historical training data will artificially inflate model accuracy while obliterating real-world predictive power. Strict point-in-time correctness within the Feature Store is mandatory.
- **Severity: Medium** - **Black Swan Events.** Models trained heavily on historical data struggle with unprecedented events (e.g., a sudden pandemic or unannounced major regional closure). The system must include manual override mechanisms and rapid decay features to pivot quickly during extreme anomalies.