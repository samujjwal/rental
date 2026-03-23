# AI Listing Assistant E2E Test — Quarantined

**Date:** 2026-03-21  
**Reason:** Test selectors do not match current implementation.

## What the tests asserted
- `data-testid="ai-suggestions"` — not present in any app component
- `data-testid="suggestion-item"` — not present in any app component  
- `data-testid="demand-indicator"` — not present in any app component
- `data-testid="demand-level"` — not present in any app component
- `data-testid="applied-indicator"` — not present in any app component

## What the current app does
`listings.new.tsx` renders `VoiceListingAssistant`, not `AIListingAssistant`.  
The `AIListingAssistant` component (when used) does not carry any of the above `data-testid` attributes.  
The backend has no `/ai/listing-suggestions` or `/ai/market-insights` endpoints — these were previously client-side mocks.

## What must happen before restoring
1. Backend implements real `/ai/listing-suggestions` and `/ai/market-insights` endpoints.
2. `AIListingAssistant` component is rendered in the listing creation route.
3. Component carries the expected `data-testid` attributes.
4. Tests are rewritten against the real implementation contracts.

Until all of the above are true, restoring this test to CI would produce false green or false red signals.
