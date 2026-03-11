# ADR-002: Internationalization Strategy

**Status:** Accepted  
**Date:** 2026-02-22  

## Context
The platform requires multi-language listing content. Currently, listing titles and descriptions are stored as single-language fields on the `Listing` model. User language preferences exist in `UserPreferences`.

## Decision
1. Introduce `ListingContent` model with `(listingId, languageCode)` unique constraint.
2. Listing read API supports `?lang=` parameter with fallback chain: requested → owner default → platform default (`en`).
3. Listing write API supports `PUT /listings/:id/content/:lang` for per-language content management.
4. Core Listing fields (title, description) remain as the default/primary language content.

## Consequences
- Listing content can be managed in multiple languages.
- Backward-compatible: existing single-language content continues to work.
- Fallback chain ensures users always see content.
