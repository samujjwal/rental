# Requirement Traceability Matrix

| Req ID | Requirement | Phase | Owner Module | Status | Test Coverage |
|--------|-------------|-------|--------------|--------|---------------|
| REQ-001 | Multi-category listing core | P1 | listings | Partial | listings.service.spec.ts |
| REQ-002 | Dynamic category attributes | P3 | categories | Not Started | category-attributes.service.spec.ts |
| REQ-003 | Listing versioning/audit | P3 | listings | Not Started | listing-version.service.spec.ts |
| REQ-004 | Multi-language content | P3 | listings | Not Started | listing-content.service.spec.ts |
| REQ-005 | Multi-currency + FX audit | P4 | payments | Not Started | fx-rate.service.spec.ts |
| REQ-006 | Date-range availability | P4 | listings | Done | availability.service.spec.ts |
| REQ-007 | Slot-based availability | P4 | listings | Not Started | availability-slot.service.spec.ts |
| REQ-008 | Inventory availability | P4 | listings | Not Started | inventory.service.spec.ts |
| REQ-009 | Pricing engine extensibility | P4 | bookings | Partial | booking-calculation.service.spec.ts |
| REQ-010 | VAT/tax clarity | P4 | tax | Partial | tax-calculation.service.spec.ts |
| REQ-011 | Booking price breakdown | P4 | bookings | Not Started | price-breakdown.service.spec.ts |
| REQ-012 | Deposit lifecycle | P5 | payments | Partial | stripe.service.spec.ts |
| REQ-013 | Refund lifecycle | P5 | payments | Partial | payouts.service.spec.ts |
| REQ-014 | Dispute financial resolution | P5 | disputes | Partial | disputes.service.spec.ts |
| REQ-015 | Payment controller hardening | P5 | payments | Not Started | payments.controller.spec.ts |
| REQ-016 | Payout determinism | P5 | payments | Not Started | payouts.service.spec.ts |
| REQ-017 | Notification unification | P6 | notifications | Not Started | notifications.controller.spec.ts |
| REQ-018 | Admin MFA enforcement | P6 | auth/admin | Not Started | admin-auth.spec.ts |
| REQ-019 | Role policy matrix | P6 | auth | Done | roles.guard (implicit) |
| REQ-020 | Verification gates | P6 | auth | Not Started | verification-gate.guard.spec.ts |
| REQ-021 | Mobile test baseline | P7 | mobile | Not Started | (new suite) |
| REQ-022 | Contract drift tests | P7 | shared-types | Not Started | contract.spec.ts |
| REQ-023 | Concurrency tests | P7 | bookings/payments | Not Started | concurrency.e2e-spec.ts |
| REQ-024 | Load tests | P7 | tests/load | Partial | api-load-test.js |
