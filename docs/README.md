# Documentation Map

This directory is the intended home for the repository's live documentation.

## Live Documentation Targets

- [`product/`](product/README.md)
  Product vision, market framing, requirements, and the canonical feature catalog.
- [`architecture/`](architecture/)
  Architecture overview, domain model, capability deep dives, ADRs, and diagrams.
- [`architecture-audit/`](architecture-audit/README.md)
  Archive pointer for historical architecture audits and refactor packs.
- [`engineering/`](engineering/README.md)
  Developer setup, build/test workflows, deployment notes, and engineering policies.
- [`operations/`](operations/README.md)
  Runbooks, SLOs, operational checklists, and production support material.
- [`qa/`](qa/README.md)
  Manual test cases, release gates, and test strategy references.
- [`users/`](users/README.md)
  End-user and operator manuals for renter, owner, and admin flows.
- [`traceability/`](traceability/)
  Requirement-to-implementation or requirement-to-test mapping.
- [`archive/`](archive/README.md)
  Historical audits, implementation summaries, execution reports, and dated notes that
  should remain accessible but must not compete with the live source of truth.

## Current Status

The repository is in the middle of a documentation consolidation effort. Many
root-level reports and app-local summaries still exist and need to be merged,
archived, or deleted. The working plan for that effort lives in
[`CONSOLIDATION_PLAN.md`](CONSOLIDATION_PLAN.md).

## Canonical Docs Created So Far

### Product

- [`product/vision.md`](product/vision.md)
- [`product/requirements.md`](product/requirements.md)
- [`product/features.md`](product/features.md)

### Engineering

- [`engineering/developer-guide.md`](engineering/developer-guide.md)
- [`engineering/testing.md`](engineering/testing.md)
- [`engineering/deployment.md`](engineering/deployment.md)
- [`engineering/integrations.md`](engineering/integrations.md)

### Operations

- [`operations/runbooks.md`](operations/runbooks.md)
- [`operations/slo.md`](operations/slo.md)

## Rules For Live Docs

- Keep durable, current, source-of-truth material under `docs/`.
- Avoid adding new dated status reports at the repo root.
- Archive historical reports instead of leaving them beside canonical docs.
- Do not commit generated test artifacts, local IDE files, or transient outputs.
