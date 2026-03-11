# Prompt 9: Global Inventory Graph

## Executive Summary
This document specifies the architecture for the Global Inventory Graph, a sophisticated property-graph database optimized for extremely complex, real-time relationship queries. As the authoritative topological map of the entire rental ecosystem, it interlinks Users, Listings, Assets, Locations, Reviews, and Financials.

## 1. Graph Architecture

Unlike the core Relational/NoSQL datastores (Prompt 1) which handle atomic transactions (Bookings, Content), the **Graph Database (e.g., AWS Neptune, Neo4j, or TigerGraph)** tracks the *connections* between those entities.

1. **Ingestion & Synchronization:** The Graph DB is populated asynchronously via Change Data Capture (CDC) pipelines (e.g., Debezium -> Kafka -> Flink -> Graph Sink) reading off the primary PostgreSQL/MongoDB clusters. Every insert/update on a core aggregate is transformed into an Edge or Node creation.
2. **Querying (Gremlin, openCypher):** Exposed internally via GraphQL or specialized gRPC endpoints, the Graph allows downstream services to traverse millions of links instantly.

## 2. Graph Schema: Nodes & Edges

The foundational ontology of the graph maps the enterprise domain model into a traversable network:

### Key Nodes (Vertices)
*   `User`: (Includes Host, Renter, Admin tags)
*   `Listing`: The market-facing representation.
*   `Asset`: The physical entity.
*   `Location`: H3 Hexagons, Cities, Countries, Points of Interest (POIs).
*   `Review`: A directional node connecting a Renter, a Host, and a specific Booking.
*   `Device/IP`: Captured by the Fraud Intelligence Platform (Prompt 8).
*   `PaymentMethod`: Abstracted financial nodes.

### Crucial Edges (Relationships)
*   `User -[OWNS]-> Asset`
*   `User -[MANAGES]-> Listing` (Crucial for Multi-Tenant/Co-Host models)
*   `Listing -[LOCATED_IN]-> Location`
*   `User -[BOOKED]-> Listing`
*   `User -[WROTE]-> Review`
*   `Review -[ABOUT]-> Listing/Host/Renter`
*   `User -[USED]-> Device/IP`
*   `User -[PAID_WITH]-> PaymentMethod`

## 3. Query Strategies & Use Cases

The Graph is the backend for several complex queries that would bring a traditional RDBMS to its knees:

### A. The "Trust & Safety / Collusion" Query (Fraud Integration - Prompt 8)
*   "Show me all `Users` who have `BOOKED` a `Listing` managed by Host X, who also share the same `USED` `Device` as Host X or share a `PAID_WITH` `PaymentMethod`."
*   *Outcome:* Instantly flags organized review manipulation or money laundering rings.

### B. The "Recommendation / Collaborative Filtering" Query (Search Integration - Prompt 6)
*   "Renter Y has previously `BOOKED` Listings A, B, and C. Find all other `Users` who also `BOOKED` A, B, and C, and return the top 10 *other* `Listings` those users have highly `REVIEWED`."
*   *Outcome:* Deeply personalized, serendipitous recommendations for the Renter.

### C. The "Agent / Concierge Context" Query (AI Concierge - Prompt 3)
*   "Find the `Location` centroid of Renter Z's upcoming `BOOKED` `Listing`, and return all `Options/Upgrades` associated with hosts who `MANAGE` inventory in that same `Location`."
*   *Outcome:* Context-aware upselling and local recommendations provided by the conversational AI.

## 4. Operational Maintenance & Indexing

*   **Time-to-Live (TTL):** Transient data (e.g., Session IPs) expires automatically, while core topological structure (Listings -> Locations) is permanent.
*   **Indexing strategy:** Core properties (User IDs, Listing IDs) are highly indexed, but the true power lies in the relationship traversals, prioritizing index-free adjacency.

---

## Architecture Observations
- Relies heavily on **Event-Driven consistency**. The Graph is slightly behind the primary datastores (usually by < 5 seconds), meaning it is perfect for analytics, recommendations, and fraud checks, but **never** for checking real-time availability (which relies on Prompt 10).
- Supports the multi-tenant Organization models seamlessly, as a `User` can simply `BELONG_TO` an `Organization` node that `MANAGES` thousands of `Listings`.

## Extensibility Assessment
- **High:** The schema-less nature of most graph databases allows for new Nodes (e.g., a new `CryptoWallet` node) or new Edges (`User -[REFERRED]-> User`) to be added instantly without platform downtime or complex database migrations.

## Critical Findings
- **Severity: High** - **Data Bloat and "Super-Nodes".** A location node like `New York City` might have millions of incoming `LOCATED_IN` edges. Traversing a Super-Node can cause catastrophic query timeouts. The Graph model must use hyper-localized nodes (H3 level 9 or 10) to fan-out relationships effectively and avoid massive hub-spoke traversal stalls.