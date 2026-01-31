# Universal Rental Portal — Architecture Overview

**Visual guide to system architecture, data flow, and component relationships**

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────┐          ┌──────────────────────────┐        │
│  │   React Router v7 Web    │          │   React Native Mobile    │        │
│  │  ┌────────────────────┐  │          │  ┌────────────────────┐  │        │
│  │  │  Browser (CSR)     │  │          │  │   iOS / Android    │  │        │
│  │  │  - React Components│  │          │  │   - Expo           │  │        │
│  │  │  - Zustand State   │  │          │  │   - Redux Toolkit  │  │        │
│  │  │  - Socket.io Client│  │          │  │   - Push Notifs    │  │        │
│  │  └────────────────────┘  │          │  └────────────────────┘  │        │
│  │  ┌────────────────────┐  │          │                            │        │
│  │  │  Node Server (SSR) │  │          │                            │        │
│  │  │  - Loaders/Actions │  │          │                            │        │
│  │  │  - Server Rendering│  │          │                            │        │
│  │  └────────────────────┘  │          │                            │        │
│  └──────────────────────────┘          └──────────────────────────┘        │
│                 │                                     │                       │
│                 └─────────────────┬───────────────────┘                       │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                         HTTPS (TLS 1.2+)
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                            CDN & LOAD BALANCER                               │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                                    │                                          │
│  ┌─────────────────────────────────▼────────────────────────────────┐       │
│  │                        CloudFront CDN                             │       │
│  │  - Static Assets Caching (JS, CSS, Images)                       │       │
│  │  - SSL/TLS Termination                                            │       │
│  │  - DDoS Protection                                                │       │
│  └─────────────────────────────────┬────────────────────────────────┘       │
│                                     │                                         │
│  ┌─────────────────────────────────▼────────────────────────────────┐       │
│  │              Application Load Balancer (ALB)                      │       │
│  │  - Health Checks                                                  │       │
│  │  - SSL Termination                                                │       │
│  │  - Path-based Routing (/api/* → Backend)                         │       │
│  └─────────────────────────────────┬────────────────────────────────┘       │
└────────────────────────────────────┼──────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
┌─────────────▼─────────┐  ┌────────▼────────┐  ┌─────────▼──────────┐
│   ECS Task (Primary)  │  │  ECS Task (2)   │  │  ECS Task (N)      │
│  ┌─────────────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐     │
│  │  NestJS Backend │  │  │  │  NestJS   │  │  │  │  NestJS   │     │
│  │  - REST API     │  │  │  │  Backend  │  │  │  │  Backend  │     │
│  │  - WebSocket    │  │  │  │           │  │  │  │           │     │
│  │  - BullMQ Jobs  │  │  │  └───────────┘  │  │  └───────────┘     │
│  └─────────────────┘  │  └─────────────────┘  └────────────────────┘
└───────────┬───────────┘           │                     │
            │                       │                     │
            └───────────────────────┴─────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                            │
        │                           │                            │
┌───────▼──────────┐    ┌──────────▼─────────┐    ┌───────────▼──────────┐
│  PostgreSQL      │    │   Redis Cluster    │    │  Elasticsearch       │
│  (RDS Aurora)    │    │   (ElastiCache)    │    │  (OpenSearch)        │
│                  │    │                    │    │                      │
│  - User Data     │    │  - Session Store   │    │  - Listing Index    │
│  - Listings      │    │  - Cache Layer     │    │  - Full-text Search │
│  - Bookings      │    │  - Rate Limiting   │    │  - Geo Queries      │
│  - Payments      │    │  - Job Queue       │    │  - Faceted Search   │
│  - Messages      │    │  - Pub/Sub         │    │  - Autocomplete     │
│  - Disputes      │    │  - Locks           │    │                      │
│                  │    │                    │    │                      │
│  Multi-AZ        │    │  Multi-AZ          │    │  Multi-AZ           │
│  Auto-scaling    │    │  Replication       │    │  3 Master Nodes     │
└──────────────────┘    └────────────────────┘    └──────────────────────┘
```

---

## Data Flow Diagrams

### 1. Booking Creation Flow

```
┌──────────┐
│  Renter  │
└────┬─────┘
     │ 1. Select dates & submit booking
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│               React Router v7 Frontend                       │
│  - Validate dates                                            │
│  - Calculate price (basePrice × days + fees)                 │
│  - Show payment form (Stripe Elements)                       │
└────┬────────────────────────────────────────────────────────┘
     │ 2. POST /api/bookings
     │    { listingId, startDate, endDate, guests }
     ▼
┌─────────────────────────────────────────────────────────────┐
│               NestJS Backend API                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BookingController                                     │ │
│  │  - Validate JWT token                                  │ │
│  │  - Check rate limits                                   │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 3. Call service                                      │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BookingService                                        │ │
│  │  - Check listing exists & active                       │ │
│  │  - Verify dates are valid                              │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 4. Acquire lock & check availability                │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AvailabilityService                                   │ │
│  │  - Lock listing (Redis distributed lock)              │ │
│  │  - Query overlapping bookings (SQL)                    │ │
│  │  - Return availability result                          │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 5. If available                                      │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BookingStateMachine                                   │ │
│  │  - Create booking in DRAFT state                       │ │
│  │  - Transition to PENDING_PAYMENT                       │ │
│  │  - Record state history                                │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 6. Create payment intent                             │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StripeService                                         │ │
│  │  - Create PaymentIntent with application_fee           │ │
│  │  - Set capture_method = manual (for deposit hold)      │ │
│  │  - Return client_secret                                │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 7. Save to database                                  │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Prisma Transaction                                    │ │
│  │  - Create Booking record                               │ │
│  │  - Create DepositHold record                           │ │
│  │  - Create LedgerEntry (debit: renter, credit: hold)   │ │
│  │  - Release Redis lock                                  │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │ 8. Queue background job                              │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BullMQ Producer                                       │ │
│  │  - enqueue: expire-payment-window (15 min)            │ │
│  └────┬───────────────────────────────────────────────────┘ │
└───────┼──────────────────────────────────────────────────────┘
        │ 9. Return response
        ▼
┌─────────────────────────────────────────────────────────────┐
│               Response to Frontend                           │
│  {                                                           │
│    bookingId: "bkg_...",                                     │
│    status: "PENDING_PAYMENT",                                │
│    paymentClientSecret: "pi_..._secret_...",                 │
│    expiresAt: "2026-01-23T10:30:00Z"                         │
│  }                                                           │
└────┬────────────────────────────────────────────────────────┘
     │ 10. Frontend confirms payment
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Stripe Elements (Client-side)                              │
│  - stripe.confirmCardPayment(clientSecret, cardElement)     │
└────┬────────────────────────────────────────────────────────┘
     │ 11. Stripe webhook
     ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/webhooks/stripe                                  │
│  Event: payment_intent.succeeded                            │
└────┬────────────────────────────────────────────────────────┘
     │ 12. Update booking state
     ▼
┌─────────────────────────────────────────────────────────────┐
│  BookingStateMachine.transition()                           │
│  - PENDING_PAYMENT → CONFIRMED                              │
│  - Update LedgerEntry (hold → platform balance)             │
│  - Emit booking.confirmed event                             │
│  - Send notification to owner                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. Real-time Messaging Flow

```
┌─────────┐                                        ┌─────────┐
│ User A  │                                        │ User B  │
│(Renter) │                                        │ (Owner) │
└────┬────┘                                        └────┬────┘
     │                                                  │
     │ 1. Connect WebSocket                             │
     │                                                  │
     ▼                                                  ▼
┌─────────────────┐                            ┌─────────────────┐
│ Socket.io       │                            │ Socket.io       │
│ Client          │                            │ Client          │
└────┬────────────┘                            └────┬────────────┘
     │ socket.emit('authenticate', token)           │
     │                                               │
     ▼                                               ▼
┌──────────────────────────────────────────────────────────────┐
│                Socket.io Gateway (Backend)                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  handleConnection()                                    │  │
│  │  - Verify JWT token                                    │  │
│  │  - Store userId → socketId mapping in Redis           │  │
│  │  - Join user's conversation rooms                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
     │                                               │
     │ 2. User A sends message                       │
     │ socket.emit('sendMessage', {                  │
     │   conversationId, text                        │
     │ })                                            │
     │                                               │
     ▼                                               │
┌──────────────────────────────────────────────────────────────┐
│                MessagingGateway                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  handleSendMessage()                                   │  │
│  │  - Validate user is participant                        │  │
│  │  - Check rate limit (10 msg/min)                       │  │
│  └────┬───────────────────────────────────────────────────┘  │
│       │ 3. Call service                                      │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MessagingService.createMessage()                      │  │
│  │  - Scan for contact info (ContactPrivacyService)       │  │
│  │  - Mask emails/phones if found                         │  │
│  │  - Save to database (Prisma)                           │  │
│  │  - Publish to Redis pub/sub channel                    │  │
│  └────┬───────────────────────────────────────────────────┘  │
└───────┼──────────────────────────────────────────────────────┘
        │ 4. Redis pub/sub distribution
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│                    Redis Pub/Sub                              │
│  Channel: message:${conversationId}                          │
│  - Broadcasts to all Gateway instances                        │
└────┬─────────────────────────────────────────────────────────┘
     │
     │ 5. All gateway instances receive
     ├──────────────────┬───────────────────┐
     ▼                  ▼                   ▼
┌──────────┐      ┌──────────┐       ┌──────────┐
│Gateway-1 │      │Gateway-2 │       │Gateway-3 │
│(User A)  │      │(User B)  │       │          │
└────┬─────┘      └────┬─────┘       └──────────┘
     │                 │
     │ 6. Emit to connected clients in room
     │                 │
     │ server.to(conversationId)
     │   .emit('message', messageData)
     │                 │
     ▼                 ▼
┌─────────────┐  ┌─────────────┐
│ User A      │  │ User B      │
│ (sender)    │  │ (recipient) │
│ - Update UI │  │ - Show msg  │
│ - Mark sent │  │ - Play sound│
└─────────────┘  └─────────────┘
                      │
                      │ 7. User B marks as read
                      │ socket.emit('markRead', messageId)
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  MessagingGateway.handleMarkRead()                           │
│  - Update ReadReceipt in DB                                  │
│  - Emit 'messageRead' event back to User A                   │
└──────────────────────────────────────────────────────────────┘
```

### 3. Search & Discovery Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Enter search: "guitar New York"
     │    Select dates, filters
     ▼
┌─────────────────────────────────────────────────────────────┐
│               React Router v7 Frontend                       │
│  - Build query params                                        │
│  - Debounce autocomplete (300ms)                             │
└────┬────────────────────────────────────────────────────────┘
     │ 2. GET /api/listings/search?
     │    query=guitar&location=New+York&
     │    startDate=2026-06-01&endDate=2026-06-05&
     │    category=instruments&priceMax=100
     ▼
┌─────────────────────────────────────────────────────────────┐
│               NestJS SearchController                        │
│  - Parse & validate query params                             │
│  - Check cache (Redis)                                       │
└────┬────────────────────────────────────────────────────────┘
     │ 3. Cache miss → query Elasticsearch
     ▼
┌─────────────────────────────────────────────────────────────┐
│               SearchService                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  buildSearchQuery()                                    │ │
│  │  {                                                     │ │
│  │    query: {                                            │ │
│  │      bool: {                                           │ │
│  │        must: [                                         │ │
│  │          // Full-text search on title/description      │ │
│  │          { multi_match: {                              │ │
│  │              query: "guitar",                          │ │
│  │              fields: ["title^2", "description"],       │ │
│  │              fuzziness: "AUTO"                         │ │
│  │          }},                                            │ │
│  │          // Geo-spatial filter                         │ │
│  │          { geo_distance: {                             │ │
│  │              distance: "25km",                         │ │
│  │              location: { lat: 40.71, lon: -74.00 }    │ │
│  │          }},                                            │ │
│  │          // Availability filter                        │ │
│  │          { range: {                                    │ │
│  │              availableFrom: { lte: "2026-06-01" }      │ │
│  │          }},                                            │ │
│  │          // Category filter                            │ │
│  │          { term: { categoryId: "instruments" }}        │ │
│  │        ],                                               │ │
│  │        filter: [                                       │ │
│  │          { term: { status: "ACTIVE" }},                │ │
│  │          { range: { basePrice: { lte: 100 }}}          │ │
│  │        ]                                                │ │
│  │      }                                                  │ │
│  │    },                                                   │ │
│  │    aggs: {                                              │ │
│  │      brands: { terms: { field: "categoryData.brand" }},│ │
│  │      priceRanges: { range: { field: "basePrice", ... }}│ │
│  │    },                                                   │ │
│  │    sort: [                                              │ │
│  │      { _score: "desc" },                               │ │
│  │      { verifiedOwner: "desc" },                        │ │
│  │      { instantBookEnabled: "desc" }                    │ │
│  │    ]                                                    │ │
│  │  }                                                      │ │
│  └────┬───────────────────────────────────────────────────┘ │
└───────┼──────────────────────────────────────────────────────┘
        │ 4. Execute search
        ▼
┌─────────────────────────────────────────────────────────────┐
│               Elasticsearch                                  │
│  - Parse query DSL                                           │
│  - Execute search across shards                              │
│  - Calculate relevance scores                                │
│  - Apply geo-distance boost                                  │
│  - Aggregate facets                                          │
│  - Return top 20 results                                     │
└────┬────────────────────────────────────────────────────────┘
     │ 5. Enrich results from PostgreSQL
     ▼
┌─────────────────────────────────────────────────────────────┐
│  SearchService.enrichResults()                               │
│  - Fetch full listing details (Prisma)                       │
│  - Include: owner info, photos, reviews                      │
│  - Check actual availability in database                     │
│  - Calculate distance from user location                     │
└────┬────────────────────────────────────────────────────────┘
     │ 6. Cache results
     ▼
┌─────────────────────────────────────────────────────────────┐
│  CacheService.set()                                          │
│  - Key: search:${hash(queryParams)}                          │
│  - TTL: 5 minutes                                            │
│  - Value: JSON.stringify(results)                            │
└────┬────────────────────────────────────────────────────────┘
     │ 7. Return to frontend
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: {                                                 │
│    results: [                                                │
│      {                                                       │
│        id: "lst_...",                                        │
│        title: "Fender Acoustic Guitar",                      │
│        basePrice: 45,                                        │
│        location: { city: "New York", distance: 2.3 },        │
│        owner: { firstName: "John", rating: 4.8 },            │
│        photos: [ "https://cdn.../thumb-123.webp" ],          │
│        instantBookEnabled: true                              │
│      },                                                      │
│      ...                                                     │
│    ],                                                        │
│    facets: {                                                 │
│      brands: [ {key: "Fender", count: 12}, ... ],            │
│      priceRanges: [ {range: "0-50", count: 45}, ... ]        │
│    },                                                        │
│    pagination: {                                             │
│      page: 1, limit: 20, total: 127, totalPages: 7          │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud (us-east-1)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Route 53 (DNS)                            │   │
│  │  rentalportal.com → CloudFront Distribution                  │   │
│  └─────────────────────┬───────────────────────────────────────┘   │
│                        │                                             │
│  ┌─────────────────────▼───────────────────────────────────────┐   │
│  │              CloudFront CDN (Global)                         │   │
│  │  - SSL/TLS Certificate (ACM)                                 │   │
│  │  - Cache static assets (max-age: 31536000)                   │   │
│  │  - Origin: S3 (frontend) + ALB (backend)                     │   │
│  └─────────────────────┬───────────────────────────────────────┘   │
│                        │                                             │
│  ┌─────────────────────▼───────────────────────────────────────┐   │
│  │          Application Load Balancer (Multi-AZ)                │   │
│  │  - Health checks on /health endpoint                         │   │
│  │  - SSL termination                                           │   │
│  │  - Target groups for ECS services                            │   │
│  └─────────────────────┬───────────────────────────────────────┘   │
│                        │                                             │
│  ┌─────────────────────▼───────────────────────────────────────┐   │
│  │                    VPC (10.0.0.0/16)                         │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Public Subnets (3 AZs)                               │  │   │
│  │  │  - NAT Gateways                                        │  │   │
│  │  │  - Application Load Balancer                           │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Private Subnets (3 AZs)                              │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │   │
│  │  │  │  ECS Fargate Tasks (Auto-scaling: 2-10)         │  │  │   │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │  │  │   │
│  │  │  │  │ Backend  │ │ Backend  │ │ Backend  │  ...    │  │  │   │
│  │  │  │  │ Task 1   │ │ Task 2   │ │ Task N   │         │  │  │   │
│  │  │  │  │ (1024CPU)│ │          │ │          │         │  │  │   │
│  │  │  │  │ (2048MB) │ │          │ │          │         │  │  │   │
│  │  │  │  └──────────┘ └──────────┘ └──────────┘         │  │  │   │
│  │  │  └─────────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Database Subnets (3 AZs)                             │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │   │
│  │  │  │  RDS Aurora PostgreSQL (Serverless v2)          │  │  │   │
│  │  │  │  ┌──────────┐ ┌──────────┐                      │  │  │   │
│  │  │  │  │ Primary  │ │ Replica  │                      │  │  │   │
│  │  │  │  │ (Writer) │ │ (Reader) │                      │  │  │   │
│  │  │  │  └──────────┘ └──────────┘                      │  │  │   │
│  │  │  │  ACU: 0.5-8.0 (auto-scales)                     │  │  │   │
│  │  │  └─────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │   │
│  │  │  │  ElastiCache Redis Cluster                      │  │  │   │
│  │  │  │  ┌──────────┐ ┌──────────┐                      │  │  │   │
│  │  │  │  │ Primary  │ │ Replica  │                      │  │  │   │
│  │  │  │  │  Node    │ │  Node    │                      │  │  │   │
│  │  │  │  └──────────┘ └──────────┘                      │  │  │   │
│  │  │  │  cache.r7g.large (2 nodes)                      │  │  │   │
│  │  │  └─────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │   │
│  │  │  │  OpenSearch Cluster                             │  │  │   │
│  │  │  │  ┌─────┐ ┌─────┐ ┌─────┐                        │  │  │   │
│  │  │  │  │ M-1 │ │ M-2 │ │ M-3 │  (Masters)             │  │  │   │
│  │  │  │  └─────┘ └─────┘ └─────┘                        │  │  │   │
│  │  │  │  ┌─────┐ ┌─────┐ ┌─────┐                        │  │  │   │
│  │  │  │  │ D-1 │ │ D-2 │ │ D-3 │  (Data nodes)          │  │  │   │
│  │  │  │  └─────┘ └─────┘ └─────┘                        │  │  │   │
│  │  │  │  r6g.large.elasticsearch (6 nodes)              │  │  │   │
│  │  │  └─────────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   S3 Buckets                                  │   │
│  │  - rental-portal-uploads (Images, Documents)                 │   │
│  │  - rental-portal-frontend (Static web assets)                │   │
│  │  - rental-portal-backups (Database backups)                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            AWS Secrets Manager                                │   │
│  │  - DATABASE_URL                                               │   │
│  │  - REDIS_URL                                                  │   │
│  │  - JWT_SECRET                                                 │   │
│  │  - STRIPE_SECRET_KEY                                          │   │
│  │  - SENDGRID_API_KEY                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            CloudWatch (Monitoring & Logs)                     │   │
│  │  - ECS task logs                                              │   │
│  │  - ALB access logs                                            │   │
│  │  - RDS slow query logs                                        │   │
│  │  - Custom application metrics                                 │   │
│  │  - Alarms (CPU, Memory, Error Rate, Latency)                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

External Services:
- Stripe API (Payments)
- SendGrid API (Emails)
- Twilio API (SMS)
- Sentry (Error tracking)
```

---

## State Machine Diagrams

### Booking Lifecycle States

```
                    ┌──────────────┐
                    │    DRAFT     │
                    │ (Created but │
                    │  not saved)  │
                    └──────┬───────┘
                           │ save()
                           ▼
        ┌──────────────────────────────────────┐
        │                                      │
        │         PENDING_PAYMENT              │
        │   (Awaiting payment confirmation)    │
        │                                      │
        │   Invariants:                        │
        │   - paymentIntent must exist         │
        │   - expiresAt = now + 15 minutes     │
        │                                      │
        └──────┬──────────────┬────────────────┘
               │              │
     payment   │              │ timeout
    confirmed  │              │ or cancel
               ▼              ▼
        ┌──────────┐   ┌──────────────┐
        │CONFIRMED │   │   EXPIRED    │
        │          │   │              │
        └────┬─────┘   └──────────────┘
             │
             │ startDate approaches
             │ (24 hours before)
             ▼
        ┌──────────────┐
        │ UPCOMING     │
        │ (Reminder    │
        │  sent)       │
        └──────┬───────┘
               │
               │ startDate reached
               ▼
        ┌──────────────────────────────────┐
        │      INSPECTION_PENDING          │
        │  (Owner inspects with renter)    │
        │                                  │
        │  Window: startDate to +6 hours   │
        └──────┬──────────────┬────────────┘
               │              │
       owner   │              │ timeout
     completes │              │
   inspection  │              ▼
               │      ┌────────────────┐
               │      │INSPECTION_     │
               │      │INCOMPLETE      │
               │      │(Auto-complete  │
               │      │ assuming OK)   │
               │      └───────┬────────┘
               ▼              │
        ┌──────────────┐      │
        │  IN_PROGRESS │◄─────┘
        │  (Active     │
        │   rental)    │
        └──────┬───────┘
               │
               │ endDate reached
               ▼
        ┌──────────────────────────────────┐
        │    RETURN_INSPECTION_PENDING     │
        │ (Owner inspects condition on     │
        │  return)                         │
        │                                  │
        │  Window: endDate to +24 hours    │
        └──────┬──────────────┬────────────┘
               │              │
       no      │              │ issues found
     issues    │              │ or dispute
     found     ▼              ▼
        ┌──────────────┐   ┌─────────────┐
        │  COMPLETED   │   │  DISPUTED   │
        │              │   │             │
        │  (Release    │   │ (Freeze     │
        │   payout)    │   │  funds)     │
        └──────┬───────┘   └─────┬───────┘
               │                 │
               │                 │ admin resolves
               │                 ▼
               │          ┌──────────────┐
               │          │   RESOLVED   │
               │          │              │
               │          └──────────────┘
               │
               │ +7 days
               ▼
        ┌──────────────┐
        │   SETTLED    │
        │ (Final state,│
        │  payout done)│
        └──────────────┘

Cancellation States (can happen from CONFIRMED, UPCOMING, IN_PROGRESS):

        ┌────────────────────┐
        │ CANCELLED_BY_RENTER│
        │                    │
        │ Refund based on    │
        │ policy + timing    │
        └────────────────────┘

        ┌────────────────────┐
        │ CANCELLED_BY_OWNER │
        │                    │
        │ Full refund +      │
        │ owner penalty      │
        └────────────────────┘
```

---

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Components                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐          ┌─────────────────┐              │
│  │  App Root       │          │  Layout         │              │
│  │  - Router setup │──────────│  - Header       │              │
│  │  - Auth context │          │  - Footer       │              │
│  │  - Socket conn  │          │  - Navigation   │              │
│  └─────────────────┘          └─────────────────┘              │
│           │                             │                        │
│           ├──────────────┬──────────────┼────────────────┐      │
│           │              │              │                │      │
│    ┌──────▼──────┐┌──────▼──────┐┌─────▼────┐  ┌──────▼─────┐│
│    │   Search    ││   Listing   ││  Booking │  │  Messages  ││
│    │   Page      ││   Details   ││  Flow    │  │  Page      ││
│    │             ││   Page      ││          │  │            ││
│    │ - Filters   ││             ││ - Dates  │  │ - Chat UI  ││
│    │ - Results   ││ - Gallery   ││ - Payment│  │ - Typing   ││
│    │ - Map       ││ - Reviews   ││ - Confirm│  │ - Receipts ││
│    └─────────────┘└─────────────┘└──────────┘  └────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Backend Modules                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐                                             │
│  │   App Module    │                                             │
│  │  - Global setup │                                             │
│  │  - Middleware   │                                             │
│  └────────┬────────┘                                             │
│           │                                                       │
│           ├────────────┬────────────┬────────────┬──────────┐   │
│           │            │            │            │          │   │
│    ┌──────▼──────┐┌───▼────┐┌──────▼──────┐┌───▼────┐┌────▼──┐│
│    │   Auth      ││Listings││  Bookings   ││Payments││Msgs   ││
│    │   Module    ││Module  ││   Module    ││Module  ││Module ││
│    │             ││        ││             ││        ││       ││
│    │ - Strategy  ││ - CRUD ││ - State     ││ - Stripe│- Socket││
│    │ - Guards    ││ - Search│- Availability│ - Refund│- Privacy││
│    │ - JWT       ││ - Photos│- Policies   ││ - Ledger│- History││
│    └─────────────┘└────────┘└─────────────┘└────────┘└────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Shared Module                                │   │
│  │  ┌────────┐ ┌────────┐ ┌──────┐ ┌───────┐ ┌──────────┐  │   │
│  │  │ Prisma │ │ Cache  │ │ Queue│ │ Search│ │ Monitoring│  │   │
│  │  │ Service│ │ Service│ │ (Bull)│ │(ElasticSearch)  │  │   │
│  │  └────────┘ └────────┘ └──────┘ └───────┘ └──────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monitoring Stack

```
┌────────────────────────────────────────────────────────────────┐
│                     Observability Pipeline                      │
└────────────────────────────────────────────────────────────────┘

   ┌──────────────┐    metrics      ┌────────────────┐
   │  NestJS App  │──────/metrics──→│  Prometheus    │
   │              │                  │  (Scraper)     │
   └──────────────┘                  └────────┬───────┘
                                              │
   ┌──────────────┐    logs          ┌───────▼────────┐
   │  ECS Tasks   │──────stdout─────→│  CloudWatch    │
   │              │                  │  Logs          │
   └──────────────┘                  └────────┬───────┘
                                              │
   ┌──────────────┐    errors        ┌───────▼────────┐
   │  Frontend    │──────capture────→│    Sentry      │
   │  + Backend   │                  │  (Error        │
   └──────────────┘                  │   Tracking)    │
                                     └────────┬───────┘
                                              │
                    ┌─────────────────────────┼────────────┐
                    │                         │            │
            ┌───────▼──────┐        ┌────────▼─────┐ ┌───▼────────┐
            │   Grafana    │        │   PagerDuty  │ │   Slack    │
            │  Dashboards  │        │   (Alerts)   │ │  (Notifs)  │
            └──────────────┘        └──────────────┘ └────────────┘
```

---

This architecture overview provides visual representations of:

- Overall system architecture with cloud infrastructure
- Data flow for key user journeys
- Component relationships and module structure
- State machine transitions for booking lifecycle
- Monitoring and observability stack

Refer to individual execution plan parts for detailed implementation code and specifications.
