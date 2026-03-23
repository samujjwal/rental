# Prompt 17: Geo-Distributed Infrastructure

## Executive Summary
This document outlines the planetary-scale deployment topology. A global rental platform catering to NA, EMEA, and APAC regions cannot run from a single data center without incurring crippling latency (>300ms) for remote users. This architecture defines the physical multi-region networking, active-active failover mechanisms, and stringent data residency constraints.

## 1. Global Deployment Topology

The infrastructure is built on multiple Tier 1 Public Clouds (AWS/GCP), abstracted primarily through Kubernetes clusters (EKS/GKE), ensuring cloud-agnostic portability and declarative infrastructure-as-code (Terraform/Crossplane).

### The Regional Cell Model
The system architecture creates identical "Cells" deployed in strategic zones:
*   **Americas Cell:** (`us-east-1` & `us-west-2`)
*   **EMEA Cell:** (`eu-central-1` / Frankfurt)
*   **APAC Cell:** (`ap-southeast-1` / Singapore & `ap-south-1` / Mumbai)

Each cell runs autonomous compute clusters (API Gateways, AI Concierge Brokers, Multi-Modal Search Heads).

### Global Edge routing
*   A user's initial DNS request (via Route53/Cloudflare) hits a Global Anycast Edge Network (e.g., Cloudflare Workers or AWS CloudFront).
*   The Edge terminates the SSL connection close to the user, runs initial Bot detection, and routes the API call via high-speed global backbones strictly to the nearest healthy Kubernetes Cell with the lowest ping.

## 2. Distributed Data Strategy

Stateless compute is easy to distribute, but State is hard. The architecture balances consistency against latency:

*   **Global Configuration (Policy Packs - Prompt 13):** Replicated 100% identically across all global regions via S3/GCS cross-region sync.
*   **Search Indices (Elasticsearch / Vector DBs):** Horizontally sharded and replicated across regions, accepting near-real-time eventual consistency lags (tolerating 2-5 seconds delay across the Atlantic cable).
*   **Core Transaction Datastore (The Single Source of Truth):** 
    *   Implementing a pure active-active globally distributed database (like Google Spanner or CockroachDB). This guarantees CP (Consistency and Partition tolerance) under the CAP theorem.
    *   A user in Asia writes a Booking intent; the DB calculates the Paxos/Raft consensus between overlapping availability zones spanning the globe before acknowledging the commit.

## 3. Disaster Recovery & Fallback

*   **Regional Failover:** If an entire AWS zone (e.g., `eu-central-1`) goes offline due to a massive fiber cut, the Edge Router automatically drains traffic to backup cells (e.g., routing European traffic to `us-east-1`).
*   **Graceful Degradation Design:** During a multi-region failover, latency inherently spikes. The UI handles the `P99` delays by displaying non-blocking progress states. Sub-systems not essential to Checkout (like Historical Review querying or Demand Forecasting) scale downwards or pause entirely to reserve cluster resources for the massive influx of rerouted search and booking traffic.

---

## Architecture Observations
- Uses an **Immutable Infrastructure** pattern. Servers are never patched or updated in place. When a security update or Node rotation occurs, new auto-scaling node pools are spun up and the old instances are cleanly terminated.
- Real-Time Availability (Prompt 10) relies on distributed caching. While writes lock locally, an anti-entropy replication mechanism cross-synchronizes the Redis state grids to prevent cross-Atlantic double bookings.

## Extensibility Assessment
- **Medium:** While horizontally scaling an *existing* region is completely automatic (HPA/KEDA), spinning up a fundamentally new physical region (e.g., launching an `af-south-1` cluster in Cape Town to expand African latency performance) requires dedicated manual provisioning of new physical Database replicas and ensuring complex BGP peering rules.

## Critical Findings
- **Severity: Blocker** - **Data Residency "Schrems II" Laws.** EU GDPR and specific laws in India/China mandate that personally identifiable information (PII) of citizens must physically remain within the geopolitical borders. The Global Database MUST support **Row-Level Geo-Partitioning**, dynamically forcing European user profiles to exist *only* on disks in the Frankfurt cluster while globally allowing aggregate, anonymized querying.
- **Severity: Critical** - **Split-Brain Protocol.** If the transatlantic fiber line severs and the US Cluster cannot talk to the EU Cluster, the system must definitively choose a side to fail (usually halting new bookings) rather than allowing both to write independently and corrupting the ledger completely.