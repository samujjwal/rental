# AI Module Restructuring Plan

**Current State:** AI/ML code scattered across 6 modules
**Target State:** Consolidated AI module with clear boundaries
**Risk Level:** Medium (module dependencies)
**Priority:** Low

---

## Current AI/ML Code Distribution

### 1. AI Module (Primary)
**Location:** `apps/api/src/modules/ai/`
**Contents:**
- `adapters/openai-provider.adapter.ts` - OpenAI integration
- `services/ai.service.ts` - Main AI service
- `services/embedding.service.ts` - Text embeddings
- `services/ai-usage-ledger.service.ts` - Usage tracking
- `dto/` - AI DTOs
- `ports/ai-provider.port.ts` - Provider interface
- `prompts/` - AI prompts
- `interceptors/` - AI telemetry

**Status:** Well-organized, should remain as central AI module

---

### 2. Moderation Module
**Location:** `apps/api/src/modules/moderation/`
**AI Code:**
- `services/text-moderation.service.ts` - Uses OpenAI for content moderation
- `services/image-moderation.service.ts` - Image moderation (likely AI-based)

**Issue:** AI moderation logic embedded in moderation module

---

### 3. Search Module
**Location:** `apps/api/src/modules/search/`
**AI Code:**
- `ports/semantic-ranking.port.ts` - Uses embeddings for semantic search

**Issue:** Embedding logic in search module

---

### 4. Listings Module
**Location:** `apps/api/src/modules/listings/`
**AI Code:**
- `services/listings.service.ts` - Uses AI for listing optimization

**Issue:** AI features embedded in listings service

---

### 5. Marketplace Module
**Location:** `apps/api/src/modules/marketplace/`
**AI Code:**
- `services/multi-modal-search.service.ts` - AI-powered search
- `services/reputation.service.ts` - AI-based reputation scoring

**Issue:** AI services in marketplace module

---

### 6. Payments Module
**Location:** `apps/api/src/modules/payments/`
**AI Code:**
- `payment-integration.spec.ts` - Test references (not actual AI code)

**Status:** Test-only, no action needed

---

## Proposed Restructuring

### Target Structure

#### 1. Central AI Module (Expanded)
**Location:** `apps/api/src/modules/ai/`

**New Services:**
- `services/content-moderation.service.ts` - Extracted from moderation module
- `services/semantic-search.service.ts` - Extracted from search/marketplace modules
- `services/listing-optimization.service.ts` - Extracted from listings module
- `services/reputation-scoring.service.ts` - Extracted from marketplace module

**Existing Services (Keep):**
- `services/ai.service.ts` - Main orchestration
- `services/embedding.service.ts` - Embedding generation
- `services/ai-usage-ledger.service.ts` - Usage tracking

---

### 2. Module Dependencies
**After Restructuring, modules should depend on AI module:**

- **Moderation Module:** Uses `ai.contentModeration`
- **Search Module:** Uses `ai.semanticSearch`
- **Listings Module:** Uses `ai.listingOptimization`
- **Marketplace Module:** Uses `ai.semanticSearch`, `ai.reputationScoring`

---

## Implementation Strategy

### Phase 1: Service Extraction
1. Create new AI services in AI module
2. Copy logic from source modules
3. Maintain existing interfaces
4. Add deprecation warnings to old implementations

### Phase 2: Dependency Updates
1. Update consuming modules to import from AI module
2. Update module imports
3. Update tests
4. Ensure backward compatibility

### Phase 3: Cleanup
1. Remove old implementations from source modules
2. Clean up unused imports
3. Update documentation

---

## Service Mapping

### Content Moderation
**From:** `moderation/services/text-moderation.service.ts`
**To:** `ai/services/content-moderation.service.ts`
**Interface:** Keep existing moderation service interface
**Implementation:** Delegate to AI module

```typescript
// Old (in moderation module)
export class TextModerationService {
  // Uses OpenAI directly
}

// New (in AI module)
export class ContentModerationService {
  // Uses OpenAI through AI module
}

// Moderation module delegates
export class TextModerationService {
  constructor(private aiService: ContentModerationService) {}
}
```

---

### Semantic Search
**From:** 
- `search/ports/semantic-ranking.port.ts`
- `marketplace/services/multi-modal-search.service.ts`

**To:** `ai/services/semantic-search.service.ts`
**Interface:** Keep existing search interfaces
**Implementation:** Centralize embedding logic

---

### Listing Optimization
**From:** `listings/services/listings.service.ts`
**To:** `ai/services/listing-optimization.service.ts`
**Interface:** Extract AI-specific methods
**Implementation:** Move AI logic to dedicated service

---

### Reputation Scoring
**From:** `marketplace/services/reputation.service.ts`
**To:** `ai/services/reputation-scoring.service.ts`
**Interface:** Extract AI scoring logic
**Implementation:** Move AI algorithms to AI module

---

## Benefits

1. **Separation of Concerns:** AI logic isolated in dedicated module
2. **Reusability:** AI services can be reused across modules
3. **Maintainability:** AI updates centralized
4. **Testing:** Easier to test AI functionality in isolation
5. **Cost Management:** Better tracking of AI usage/costs

---

## Risks

### Breaking Changes
- **Risk:** Module interface changes
- **Mitigation:** Maintain backward compatibility through delegation pattern

### Performance
- **Risk:** Additional module layers could impact performance
- **Mitigation:** Benchmark before/after, optimize if needed

### Complexity
- **Risk:** Increased module dependencies
- **Mitigation:** Clear interfaces, dependency injection

---

## Estimated Effort

- **Phase 1:** 8-12 hours (service extraction)
- **Phase 2:** 6-8 hours (dependency updates)
- **Phase 3:** 2-3 hours (cleanup)

**Total:** 16-23 hours

---

## Recommendation

Given the low priority and significant effort, this restructuring should be:

1. **Deferred** to a dedicated AI/ML improvement sprint
2. **Prioritized** only if AI features are being significantly expanded
3. **Considered** as part of a broader technical debt initiative

**Alternative:** Keep current structure. The AI code is reasonably organized within its respective modules, and the overhead of consolidation may not justify the benefits at this time.

---

## Status

**Decision Required:** Proceed with restructuring or defer?

**Next Steps:**
- Team review of this plan
- Decision on priority and timing
- If approved: Schedule dedicated implementation sprint
