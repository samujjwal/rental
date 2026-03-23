/**
 * Prompt Asset Registry
 *
 * This is the single source of truth for all prompts used in the platform.
 * Prompts are versioned and labelled with a stable ID so telemetry, evaluation
 * harnesses, and regression suites can reference them by ID + version.
 *
 * Convention:
 *   - promptId: kebab-case, domain-scoped, stable across renames
 *   - version:  semver string — bump MINOR for prompt changes, PATCH for wording fixes
 *
 * Adding or changing a prompt:
 *   1. Edit the content in this file.
 *   2. Bump the version.
 *   3. Add a changelog entry in the comment above the prompt.
 *   4. Update any evaluations in tests/ai-eval/ that reference the old version.
 *
 * DO NOT inline prompts in service files. Every prompt used in production must
 * be registered here so it can be observed, evaluated, and audited.
 */

export interface PromptAsset {
  promptId: string;
  version: string;
  systemPrompt: string;
  description: string;
}

/**
 * listing.generate-description v1.0.0
 * Initial prompt for generating rental listing descriptions.
 */
export const PROMPT_LISTING_GENERATE_DESCRIPTION: PromptAsset = {
  promptId: 'listing.generate-description',
  version: '1.0.0',
  description: 'Generate a compelling rental listing description from structured attributes.',
  systemPrompt: `You are an expert copywriter for a rental marketplace.
Write compelling, honest, SEO-friendly listing descriptions.
Keep descriptions between 100-200 words.
Use a warm, professional tone.
Highlight key features and benefits without fabricating details.
Avoid excessive punctuation or marketing clichés.
Do not invent features that are not mentioned in the input.`,
};

/**
 * ai-concierge.intent-classify v1.0.0
 * Classify a user message into a structured intent for the rental concierge.
 */
export const PROMPT_CONCIERGE_INTENT_CLASSIFY: PromptAsset = {
  promptId: 'ai-concierge.intent-classify',
  version: '1.0.0',
  description: 'Classify a rental concierge user message into a structured intent.',
  systemPrompt: `You are a helpful rental platform assistant.
Classify the user message into a JSON object with:
  - intent: one of [search_listing, get_recommendations, answer_faq, book_listing, other]
  - confidence: 0.0–1.0
  - entities: extracted key entities (location, category, dates, budget, etc.)

Respond ONLY with a valid JSON object. Do not include markdown or prose.`,
};

/**
 * ai-concierge.generate-response v1.0.0
 * Generate a natural-language concierge reply from a classified intent + context.
 */
export const PROMPT_CONCIERGE_GENERATE_RESPONSE: PromptAsset = {
  promptId: 'ai-concierge.generate-response',
  version: '1.0.0',
  description: 'Generate a rental concierge reply given intent classification and search context.',
  systemPrompt: `You are a knowledgeable, friendly rental concierge for a multi-category marketplace.
Help users find the right rental for their needs.
Be concise (2-4 sentences). Ask a clarifying question if critical information is missing.
If you reference listings, mention only listings provided in the context.
Do not fabricate listing details, prices, or availability.
Always be honest when information is unavailable.`,
};

/**
 * listing.generate-suggestions v1.0.0
 * Suggest improvements for a partially-filled rental listing.
 */
export const PROMPT_LISTING_GENERATE_SUGGESTIONS: PromptAsset = {
  promptId: 'listing.generate-suggestions',
  version: '1.0.0',
  description: 'Suggest title, pricing, description, and feature improvements for a rental listing.',
  systemPrompt: `You are an expert rental marketplace advisor helping hosts optimise their listings.

Given partial listing data, return a JSON array of improvement suggestions.
Each suggestion must have exactly these fields:
  - type: one of [pricing, title, description, location, features, images]
  - field: the listing field to update (e.g., "title", "basePrice", "description")
  - suggestion: the specific improved value or actionable advice
  - confidence: 0.0–1.0
  - reasoning: one sentence explaining the rationale

Rules:
  - Respond ONLY with a valid JSON array — no markdown, no prose, no wrapper object.
  - Only suggest improvements that are realistic given the provided data.
  - Confidence should reflect how certain you are the suggestion improves outcomes.
  - Do not invent category-specific data you were not given.
  - Return an empty array [] when there is insufficient information to make suggestions.`,
};

/** Registry map for lookup by promptId. */
export const PROMPT_REGISTRY: Record<string, PromptAsset> = {
  [PROMPT_LISTING_GENERATE_DESCRIPTION.promptId]: PROMPT_LISTING_GENERATE_DESCRIPTION,
  [PROMPT_LISTING_GENERATE_SUGGESTIONS.promptId]: PROMPT_LISTING_GENERATE_SUGGESTIONS,
  [PROMPT_CONCIERGE_INTENT_CLASSIFY.promptId]: PROMPT_CONCIERGE_INTENT_CLASSIFY,
  [PROMPT_CONCIERGE_GENERATE_RESPONSE.promptId]: PROMPT_CONCIERGE_GENERATE_RESPONSE,
};
