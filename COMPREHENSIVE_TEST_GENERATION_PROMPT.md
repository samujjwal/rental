# Comprehensive Test Generation Prompt for Product Codebase
## Focus: Granular Integration Tests, End-to-End Tests, and Playwright-Based User Journey Coverage

You are tasked with scanning and analyzing the entire product codebase thoroughly and generating a complete, highly detailed, production-grade test plan and test case inventory.

Your objective is **not** to produce a shallow or generic list of tests. Your objective is to derive a **comprehensive, granular, implementation-aware, behavior-aware, and user-journey-aware** set of test cases that ensures the product can be validated through a combination of:

- integration tests
- end-to-end (E2E) tests
- Playwright-based browser E2E tests
- manual test support scenarios
- infra-aware execution and validation requirements

The final output must be detailed enough that an engineering team and QA team can directly implement, automate, execute, and manually validate the system with minimal ambiguity.

---

## Core Goal

Scan the product codebase thoroughly and generate the full test case inventory needed to validate:

- all major and minor features
- all modules, packages, services, pages, routes, workflows, APIs, and background processes
- all user journeys and interaction paths
- all business rules
- all UI states and transitions
- all backend-to-frontend data flows
- all persistence and retrieval flows
- all integrations and side effects
- all happy paths, alternate paths, negative paths, edge cases, failure modes, recovery behavior, and concurrency-sensitive flows
- all infra assumptions required for realistic manual and automated validation

The emphasis must be on **comprehensive and extremely granular integration and E2E coverage**, especially **Playwright-based full user journey testing**.

---

## Non-Negotiable Principles

### 1. Codebase-first analysis
Do not invent tests in the abstract. First inspect the real codebase thoroughly:
- frontend code
- backend code
- APIs
- DB schema and migrations
- event flows
- queues/jobs/workers
- auth flows
- permissions/RBAC
- shared libraries
- configs
- env usage
- feature flags
- state management
- caching
- file upload/download flows
- notifications
- analytics hooks
- observability hooks
- third-party integrations
- background processing
- retries/timeouts/fallbacks
- error boundaries
- route guards
- form validation
- data loaders
- async actions
- batch operations
- scheduled jobs
- CLI/admin/dev tooling if relevant to product behavior

Every generated test case must be grounded in actual code, actual behavior, or clearly implied expected behavior.

### 2. No shallow coverage
Do not stop at "login test", "create item test", or similar high-level entries. Break every flow into granular actions and observable outcomes.

Example:
Do **not** write only:
- User logs in successfully

Instead break it into:
- login page renders expected controls
- empty state of login form
- inline validation behavior
- keyboard submission
- disabled state during submission
- loading indicator behavior
- request payload validation
- success redirect target
- auth token persistence
- user context hydration
- post-login initial data fetch
- protected route unlock behavior
- role-based landing behavior
- error toast or message behavior on failure
- retry behavior
- refresh persistence
- logout invalidates session and protected data access

### 3. User-journey complete coverage
All meaningful user journeys must be identified and broken down end to end:
- first-time user journeys
- returning user journeys
- admin/operator journeys
- privileged vs restricted user journeys
- core business workflows
- setup flows
- CRUD flows
- approval/review flows
- search/filter/sort flows
- bulk actions
- import/export flows
- onboarding flows
- recovery flows
- failure/retry flows
- empty data journeys
- partial data journeys
- degraded system journeys

### 4. Integration and E2E priority
Prioritize generation of:
- integration test cases
- backend integration test cases
- frontend integration test cases
- full-stack E2E flows
- Playwright scenarios that simulate realistic user behavior

Unit tests can be referenced, but the major emphasis must be on integration and E2E coverage.

### 5. Manual-test realism
The generated output must help support real manual testing with proper infrastructure. Include:
- required environments
- required data setup
- required test accounts/roles
- seed data assumptions
- mock vs real integration recommendations
- browser/device matrix where appropriate
- observability/logs/DB/message queue verification points
- feature flag requirements
- external dependency needs
- preconditions and postconditions

### 6. Production-grade rigor
Assume the product must meet a strict production bar. Test planning must cover:
- correctness
- resilience
- security-sensitive flows
- privacy-sensitive flows
- concurrency
- data consistency
- idempotency
- retries
- timeout handling
- partial failure handling
- rollback expectations
- performance-sensitive journey checkpoints
- accessibility-critical interactions
- auditability and traceability where relevant

---

## Analysis Scope

Perform a thorough scan of the entire codebase and derive tests from:

### Product structure
- apps/products
- packages/libraries/shared modules
- frontend apps
- backend services
- worker services
- infra/config folders
- test folders
- docs/specs/PRDs if present
- routes/pages/components
- services/controllers/resolvers
- repositories/data access layers
- event producers/consumers
- queue processors
- cron/schedulers
- auth/permission modules
- middleware/interceptors/guards
- validation schemas
- DTOs/contracts/OpenAPI/GraphQL/proto
- database models/schema/migrations
- seed/test fixtures
- analytics/telemetry hooks
- error handling paths
- feature toggle logic

### Functional dimensions
Identify and cover:
- rendering behavior
- input handling
- validation
- state updates
- async effects
- server communication
- navigation/redirects
- authorization checks
- persistence
- search/filter/sort/pagination
- upload/download
- notifications
- settings/preferences
- workspace/project/account scoping
- collaboration if applicable
- role/persona-specific actions
- background jobs
- eventual consistency paths
- integration with third-party services
- import/export/reporting
- data refresh/synchronization
- offline/degraded behavior if present

---

## Required Output Structure

Generate the output as a structured Markdown document with the following sections.

# 1. Executive Summary
Provide:
- product/modules scanned
- overall test strategy summary
- key risks
- coverage philosophy
- test pyramid positioning with emphasis on integration/E2E
- major infra requirements for realistic execution

# 2. Codebase Coverage Map
Create a detailed mapping of:
- modules/packages/services/pages/routes/components
- their responsibilities
- risk level
- recommended test type coverage:
  - integration
  - E2E
  - Playwright E2E
  - manual validation
- missing or under-testable areas
- parts of code that require refactoring to improve testability

# 3. User Journey Inventory
Enumerate all user journeys with granular breakdown:
- journey name
- actor/persona/role
- entry point
- prerequisites
- main steps
- alternate branches
- error branches
- expected side effects
- systems touched
- validation points
- recommended automation level

Examples:
- first-time signup and onboarding
- login/logout/session restore
- create/edit/delete core entity
- search and filter entity list
- view detail and related data
- multi-step wizard flows
- approval/rejection flow
- file upload and validation
- settings change and persistence
- admin management flows
- background processing status tracking
- notification-triggered navigation
- bulk update flow
- export/import flow

# 4. Integration Test Case Catalog
Create a very granular catalog of integration test cases.

For each test case include:
- unique ID
- module/feature
- test title
- objective
- scope
- preconditions
- test data/setup
- steps
- expected results
- assertions
- downstream side effects to verify
- edge conditions
- cleanup requirements
- priority
- automation notes

Cover at minimum:
- API-to-service integration
- service-to-repository integration
- repository-to-database integration
- auth and permission integration
- validation and contract enforcement
- event publication/consumption
- queue/job processing
- caching behavior
- transaction behavior
- idempotency
- retries/timeouts
- third-party integration boundaries
- notification dispatch triggers
- audit/log/event emission if applicable

# 5. End-to-End Test Case Catalog
Create a full E2E test catalog spanning the complete product behavior.

For each test case include:
- unique ID
- journey/feature
- business objective
- actor
- prerequisites
- environment requirements
- seed data requirements
- exact user steps
- exact system responses expected after each step
- UI expectations
- backend/API expectations
- DB/persistence expectations where relevant
- event/job/notification expectations where relevant
- postconditions
- negative/alternate variants
- priority

Cover:
- happy path
- alternate path
- invalid input path
- permission-denied path
- partial failure path
- stale data/conflict path
- retry/recovery path
- session expiration path
- empty state path
- large data path
- multi-user interaction path if applicable

# 6. Playwright Test Case Catalog
Generate a dedicated Playwright-focused catalog for browser automation.

For each scenario include:
- unique ID
- feature/journey
- browser context assumptions
- viewport/device targets if relevant
- preloaded state/session needs
- fixtures required
- step-by-step user interactions
- selectors/locator strategy recommendations
- expected DOM/UI assertions
- network assertions
- navigation assertions
- storage/session assertions
- accessibility assertions where relevant
- screenshot/trace/video capture recommendations
- flake-risk notes
- cleanup/reset requirements

The Playwright plan must explicitly cover:
- route/page access
- page rendering correctness
- form behavior
- client validation
- server validation surfacing
- inline state changes
- toasts/modals/drawers/dialogs
- navigation and redirects
- search/filter/sort/pagination
- optimistic update and rollback behavior
- loading/skeleton/spinner states
- empty/error/success states
- keyboard navigation
- tab order and focus behavior
- refresh persistence
- multi-tab/session behavior if relevant
- download/upload flows if relevant
- network failure simulation
- auth/session timeout handling
- role-based route and action gating

# 7. Manual Testing Matrix
Create a manual test execution matrix for realistic validation.

For each major workflow specify:
- workflow name
- tester persona
- environment
- test accounts required
- data prerequisites
- infra dependencies
- manual validation steps
- what to observe in UI
- what to verify in logs
- what to verify in DB
- what to verify in queue/events/worker systems
- what to verify in external integrations
- expected timing/latency windows if relevant
- rollback/reset steps

# 8. Test Data and Environment Plan
Define:
- environments needed
- test data strategy
- seeded datasets
- role/account matrix
- synthetic vs realistic data guidance
- deterministic fixtures
- isolated vs shared environment guidance
- third-party sandbox needs
- secrets/config requirements
- browser/device matrix
- DB reset strategy
- queue reset strategy
- file storage reset strategy

# 9. Infra and Observability Requirements for Testing
Specify everything required to support dependable testing:
- application services required
- DB dependencies
- queues/workers
- cache services
- file/object storage
- mock servers or sandbox integrations
- telemetry/logging/tracing requirements
- test reporting
- artifact capture
- Playwright traces/screenshots/videos
- API logs
- DB inspection points
- event bus inspection
- background worker dashboards/logs
- feature flag configuration
- seed/reset automation recommendations

# 10. Coverage Gaps and Risk Areas
Explicitly identify:
- flows not testable with current design
- missing hooks or selectors for Playwright
- hidden side effects
- brittle async behavior
- unclear contracts
- missing observability
- poor fixture support
- auth/testability pain points
- data coupling issues
- concurrency risks
- nondeterministic flows
- external dependencies likely to cause flaky tests
- recommended code or infra changes before automation

# 11. Prioritized Execution Plan
Provide a phased rollout plan:
- Phase 1: critical smoke and blocking journeys
- Phase 2: core business workflows
- Phase 3: permissions, edge cases, failures
- Phase 4: broader regression coverage
- Phase 5: resilience, concurrency, and non-functional journey coverage

For each phase include:
- objective
- included suites
- dependency requirements
- exit criteria
- recommended CI/CD integration strategy

# 12. Final Deliverables
Produce:
- complete test inventory
- grouped test suites
- recommended file/folder organization for tests
- Playwright suite structure
- integration test suite structure
- naming conventions
- tagging strategy
- CI categorization:
  - smoke
  - PR-gating
  - nightly
  - full regression
  - pre-release

---

## Test Design Expectations

When generating test cases, think in terms of real user and system behavior.

### Always cover:
- happy paths
- alternate valid paths
- invalid input paths
- null/empty input paths
- boundary values
- duplicate submissions
- retry behavior
- race conditions where relevant
- permission mismatches
- stale session/token expiration
- backend validation mismatch
- slow network behavior
- partial rendering and async loading
- cancellation/abort behavior
- refresh and back/forward navigation behavior
- data mutation reflected in list/detail/dashboard views
- failed save/update/delete behavior
- eventual consistency verification
- audit/event/notification side effects
- cross-role visibility restrictions
- state restoration after error
- unsaved changes handling
- modal/dialog dismissal behavior
- keyboard and accessibility-relevant actions
- mobile/responsive interaction if product is responsive

### For integration tests specifically, ensure coverage of:
- contracts between layers
- serialization/deserialization correctness
- schema validation
- database constraints
- repository filtering/sorting/pagination logic
- transaction boundaries
- retry logic
- timeout propagation
- event emission payload correctness
- job enqueue and processing behavior
- deduplication/idempotency logic
- cache invalidation and refresh logic
- auth guard and policy enforcement
- tenant/workspace/project scoping rules

### For Playwright specifically, ensure coverage of:
- true user navigation through UI
- DOM stability and locator reliability
- actionability of controls
- rendered content accuracy
- URL changes
- persisted state after reload
- request/response visible outcomes
- console/network errors
- traceability for failures
- flake reduction strategies
- resilient selectors based on role, label, test id, or semantic structure

---

## Additional Instructions

- Be exhaustive, but stay implementation-grounded.
- Do not skip "small" flows. Small flows often cause production regressions.
- Do not assume that existing tests are sufficient; validate against actual code behavior.
- Where behavior is ambiguous, identify ambiguity explicitly and propose test assumptions.
- Where code is incomplete, still generate expected test coverage and mark dependency on implementation completion.
- Highlight duplicated test intent and consolidate where appropriate, but do not collapse distinct behavioral scenarios.
- Prefer behavior-driven naming for tests.
- Identify which tests are best for:
  - integration suite
  - backend E2E suite
  - Playwright browser suite
  - manual testing checklist
- Explicitly call out which flows should run in CI on every PR vs nightly vs pre-release.
- Include infra-aware manual verification points so that testers can verify not just UI, but also API effects, DB changes, event emissions, queue processing, and side effects.

---

## Quality Bar for the Output

The resulting output must be:
- comprehensive
- granular
- codebase-aware
- user-journey-aware
- infra-aware
- production-grade
- implementation-ready
- suitable for both QA and engineering
- usable as a direct basis for writing integration tests, E2E tests, and Playwright automation

The output must read like it was created by a principal-level test architect who has deeply inspected the real codebase.

---

## Final Instruction

Now scan the codebase thoroughly and generate the complete Markdown test analysis and test case inventory following all requirements above.

Do not provide a brief summary.  
Do not provide a generic checklist.  
Produce the full detailed output.
