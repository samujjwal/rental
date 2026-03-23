# Policy Engine

This document is the canonical summary of the policy and rules engine direction
for the platform.

## Why It Exists

Marketplace behavior varies by country, payment rules, tax requirements,
consumer protection needs, identity requirements, and compliance obligations.
That variation should not be hardcoded into domain services with scattered
country conditionals.

## Core Principles

- domain services should consume policy decisions, not country-specific branches
- policy resolution should be runtime-based
- rules should be versioned and auditable
- decisions should be explainable and replayable
- policy logic should be independently testable

## Desired Flow

```text
request context -> context resolver -> policy engine -> policy registry / rule store
                                              |
                                              -> audit trail
```

## Capability Areas

- tax calculation
- fee and pricing rules
- supported currency and locale configuration
- booking constraints
- cancellation and refund policy
- compliance and identity requirements
- explainability and audit logging

## Implementation Guidance

- avoid `if (country === "...")` logic in domain services
- resolve jurisdiction and context once, then evaluate rules centrally
- version rules with effective dates so historical decisions remain explainable
- log matched rules and final decisions for operator visibility

## Related Code Areas

- `apps/api/src/modules/policy-engine/`
- payment, tax, booking, compliance, and marketplace modules that consume policy outputs
