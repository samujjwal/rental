# Prompt 16: Global Observability Platform

## Executive Summary
This document outlines the Enterprise Observability strategy. As a highly distributed, microservice-based architecture deployed across multiple global regions, traditional "logging" is insufficient. The system implements a three-pillar observability approach (Metrics, Traces, Logs) enhanced by continuous AI anomaly detection to guarantee strict SLAs (Service Level Agreements) (e.g., 99.99% multi-modal search uptime).

## 1. The Three Pillars of Ingestion

All internal services interface with a unified agent (e.g., OpenTelemetry Collector) running as a sidecar/daemonset on Kubernetes.

### A. Distributed Tracing (The "Where")
*   Every inbound request (Search, Booking, Payment) is assigned a `TraceID`.
*   As the request hops through the API Gateway -> Search Orchestrator -> Availability Redis -> Inventory DB, specific spans measure the network latency and processing time of each segment.
*   **Backend:** Jaeger or Honeycomb.

### B. High-Cardinality Metrics (The "What")
*   Time-series aggregates measuring systemic health: API error rates (`HTTP 5xx`), checkout conversion funnel drops, and infrastructure load (CPU, Redis Memory).
*   **Backend:** Prometheus or VictoriaMetrics exposed via Grafana.

### C. Structured Logging (The "Why")
*   All logs are enforced as strict JSON objects, never raw strings. They inherently attach the `TraceID`, `UserID` (anonymized), `TenantID`, and `Locale`.
*   **Backend:** Elasticsearch or ClickHouse.

## 2. Business & Engineering Dashboards

Operations are categorized into targeted monitoring views:

*   **Engineering SRE Views:** Focused on P99 search latency, Database active connection counts, and Kafka consumer group lags.
*   **Financial/Business Views:** Real-time dashboards monitoring Active Gross Booking Value (GBV) per minute, Payout failure rates, and Liquidity Map (Prompt 2) imbalances.
*   **Feature Flag Views:** Monitoring error rates actively segregated by User Segments (e.g., "Are bugs spiking only for Safari users in India utilizing the new v2 Identity Verification flow?").

## 3. Proactive AI Anomaly Detection

Manually configuring static alert thresholds (e.g., `Alert if Search Errors > 5%`) fails at global scale because traffic continuously oscillates between day/night cycles and localized holidays.

*   The Observability Platform runs **Unsupervised ML Models (e.g., K-Means or Isolation Forests)** over the time-series metric data.
*   It establishes baseline seasonal bands. If `Booking Creation Rate in Paris` drops by 30% *specifically compared to the expected volume for 3 PM on a Tuesday*, the system flags a potential localized network partition or silently failing third-party API, bypassing static thresholds entirely.

---

## Architecture Observations
- Uses a **Sample/Tail strategy** for Tracing. Keeping 100% of traces for billions of API calls is economically unviable. The system samples 100% of errors and tail-samples 5% of successful requests for baseline monitoring.
- All PII (Personally Identifiable Information like PANs, strict coordinates) is automatically hashed/scrubbed at the OpenTelemetry edge collector before it ever reaches the central telemetry databases to comply with GDPR/CCPA.

## Extensibility Assessment
- **High:** The use of standardized OpenTelemetry protocols ensures that whether an engineer spins up a NestJS service, a Rust micro-agent, or a Python ML inference pipe, they seamlessly integrate into the global mesh without custom instrumentation hacks.

## Critical Findings
- **Severity: High** - **Telemetry Spikes / DDoS.** If the system is under an attack (or suffers a cascading failure loop), the resulting explosion in log volume can crash the ELK/Prometheus clusters, completely blinding engineers precisely when visibility is most critical. Strict rate-limiting and backpressure buffers must exist at the ingestion layer.