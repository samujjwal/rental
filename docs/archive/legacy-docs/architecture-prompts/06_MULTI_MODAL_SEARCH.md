# Prompt 6: Multi-Modal Marketplace Search

## Executive Summary
This document particulars the enterprise-grade Multi-Modal Search architecture. Crucial for converting user intent into bookings, this system unifies text, geospatial, temporal, image, and semantic signals into a single, high-performance querying interface. It balances the strict constraints of real-time availability with the fuzzy logic of personalized recommendations.

## 1. Search Architecture Overview

The system moves beyond simple keyword matching, employing a composite architecture that federates queries across specialized datastores:

1.  **API Gateway / Search Orchestrator:** The single entry point (e.g., GraphQL API) that parses incoming multi-modal requests (text, filters, maps, dates).
2.  **Lexical & Geo-Spatial Engine (Elasticsearch / OpenSearch):**
    *   Handles precise text matching (e.g., "WiFi", "Pool").
    *   Executes complex bounding box and radius queries (S2 Geometry / GeoHash).
    *   Applies strict boolean filters (e.g., Price < $150, Bedrooms >= 2).
3.  **Semantic & Vector Engine (Pinecone / Milvus / Qdrant):**
    *   Executes nearest-neighbor searches on user intent vectors (e.g., "Cozy cabin for a romantic winter getaway").
    *   Handles Image-to-Image search (e.g., matching the vibe of an uploaded photo to listing photos via CLIP embeddings).
4.  **Real-Time Availability Filter (Redis / Custom Interval Tree Service):**
    *   *Prompt 10 Integration:* Quickly intersects the candidate listing IDs against the hyper-accurate, sub-second availability graph. Only listings bookable for the requested dates proceed to ranking.

## 2. Query Execution Pipeline

A typical multi-modal search request (`"Beach house in Malibu next weekend under $500, similar to this vibe [image]"`) follows this execution path:

### Phase 1: Intent Parsing & Query Formulation
*   **NLP/NER (Named Entity Recognition):** Extracts "Malibu" (Location), "next weekend" (Temporal), "$500" (Price Constraint), "Beach house" (Category).
*   **Vectorization:** The text ("vibe") and the image are simultaneously embedded into the shared latent space.

### Phase 2: Candidate Generation (Recall)
*   **Geo/Lexical Query (Elasticsearch):** Retrieves a broad set of (e.g., 5,000) active listings in Malibu under $500/night.
*   **Vector Query (Pinecone):** Retrieves top 5,000 listings globally matching the image/text embedding.
*   **Intersection:** The orchestrator intersects these sets (or processes them in parallel depending on the query type) to a defined candidate pool (e.g., 1,000 listings).

### Phase 3: Availability Pruning
*   The 1,000 candidate IDs are sent to the **Real-Time Availability Graph (Prompt 10)**.
*   Listings blocked for "next weekend" are instantly dropped, resulting in a refined set of actionable inventory (e.g., 300 listings).

### Phase 4: Dynamic Ranking & Personalization
*   **Learning to Rank (LTR) Model (e.g., XGBoost / Deep Neural Nets):** Scores the remaining 300 listings.

## 3. Ranking Signals & Personalization System

The final order of results is determined by the LTR model, which weights:

1.  **Relevance Signals:** Text match (TF-IDF/BM25), Semantic similarity score, Geographic proximity to the search centroid.
2.  **Quality Signals (Trust & Safety - Prompt 14):** Average review score, host response rate, cancellation rate, verified photos, Superhost status.
3.  **Liquidity & Business Signals (Marketplace Liquidity Engine - Prompt 2):** Margin/commission tiers, new listing boost (to build initial momentum), demand shaping multipliers (boosting under-utilized inventory).
4.  **Personalization System (User Embeddings):**
    *   **Short-Term History:** What has the user clicked on in the last 15 minutes?
    *   **Long-Term Affinity:** Does the user consistently book entire homes over private rooms? Do they prefer modern vs. rustic aesthetics?
    *   **Collaborative Filtering:** What did similar users ultimately book in this area?

## 4. Operational Considerations

*   **Near Real-Time Indexing:** Updates to listings (new photos, price changes, calendar blocks) must propagate to Elasticsearch/Vector DBs within seconds via Change Data Capture (CDC) (e.g., Debezium -> Kafka -> Sink).
*   **Query Caching (Redis/Varnish):** Frequent, generic queries (e.g., "New York City next weekend") are heavily cached, bypassing the complex ranking pipeline until the candidate pool changes significantly.

---

## Architecture Observations
- Relies on **scatter-gather federation**: The Orchestrator manages the concurrent fetching and aggressive bounding of timeouts from the specialized datastores.
- The separation of Candidate Generation (Elasticsearch + Vector DB) from Ranking (LTR) and Availability Pruning allows independent scaling of these entirely different computational workloads.

## Extensibility Assessment
- **High:** New search modalities (e.g., Voice Search via the AI Concierge - Prompt 3, or Video Search) integrate simply as new embedding models generating different vectors into the shared latent space, requiring zero changes to the core ranking logic.
- Adding a new complex ranking signal (e.g., "Eco-friendly badge") involves adding the feature to the offline training data for the LTR model.

## Critical Findings
- **Severity: Critical** - **Index Staleness.** If the CDC pipeline lags, the Search engine will return listings that have been deactivated or show incorrect dynamic prices, severely damaging trust and conversion rates. The Search Index must guarantee eventual consistency within strict SLAs (e.g., < 5 seconds).
- **Severity: Blocker** - **Availability De-sync.** Generating candidates is fast, but filtering thousands of IDs against a complex interval tree *synchronously* during the search request is a major latency bottleneck. The Availability Graph must be hyper-optimized (in-memory, bitmap indexing) for batch ID checks.