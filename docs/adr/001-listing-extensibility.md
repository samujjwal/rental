# ADR-001: Listing Core + Extension Model

**Status:** Accepted  
**Date:** 2026-02-22  

## Context
The platform supports multiple rental categories (vehicles, spaces, clothing, equipment, etc.) each requiring category-specific fields. Currently, category-specific data is stored in a JSON metadata field on the Listing model, with static template definitions in `CategoryTemplateService` and duplicated field maps in `apps/web/app/lib/category-fields.ts`.

## Decision
1. Retain one `Listing` core entity with shared fields (title, description, price, location, etc.).
2. Introduce `CategoryAttributeDefinition` (DB-backed) to define category-specific fields dynamically.
3. Introduce `ListingAttributeValue` to store normalized attribute values per listing.
4. Frontend forms will be server-driven from `CategoryAttributeDefinition` metadata.
5. Static category field registries (backend `CATEGORY_TEMPLATES` and web `category-fields.ts`) will be deprecated after migration to DB-backed definitions.

## Consequences
- New categories or fields can be added without code changes.
- Single source of truth for category schema.
- Migration required to backfill existing JSON metadata into normalized tables.
