# AI Concierge System

> **IMPLEMENTATION RECONCILIATION — March 21, 2026**
>
> This document was written as a *target-state specification* for a multi-agent orchestration
> architecture. The sections below describe the intended long-term design, not the current
> live implementation. Do not rely on this document to understand what is deployed today.
>
> **Current live implementation (as of March 21, 2026):**
>
> | Capability | Implemented | Notes |
> |---|---|---|
> | Conversation session management | ✅ | `AiConciergeService.startSession()` / `endSession()` backed by `AiConversation` + `AiConversationTurn` Prisma models |
> | Intent classification (LLM) | ✅ | `classifyIntent()` via `AiProviderPort.complete()` using `ai-concierge.intent-classify` prompt asset v1.0.0 |
> | Intent classification (pattern fallback) | ✅ | Keyword-based fallback when provider is unavailable |
> | Response generation (LLM) | ✅ | `generateResponse()` via `AiProviderPort.complete()` using `ai-concierge.generate-response` prompt asset v1.0.0 |
> | Response generation (template fallback) | ✅ | Per-intent template responses when provider is unavailable |
> | Personalized recommendations | ✅ | Booking history + category signal–based listing query |
> | AI provider abstraction | ✅ | `AiProviderPort` interface; `OpenAiProviderAdapter`; provider-swappable via DI |
> | Prompt registry / versioning | ✅ | `apps/api/src/modules/ai/prompts/prompt-registry.ts` |
> | Multi-agent orchestration (LangChain/LlamaIndex) | ❌ | Not implemented — see target architecture below |
> | Tool calling / function calling | ❌ | Not implemented |
> | RAG / vector grounding | ❌ | pgvector embeddings exist for search; not yet wired to concierge context |
> | Real-time availability grounding | ❌ | Not implemented in concierge path |
> | Streaming responses | ❌ | Not implemented |
> | PII masking in AI flows | ❌ | Not implemented |
> | Dispute / booking action execution | ❌ | Concierge is advisory only; no action execution |
>
> **What to read instead for current implementation:**
> - Provider interface: [`apps/api/src/modules/ai/ports/ai-provider.port.ts`](../../apps/api/src/modules/ai/ports/ai-provider.port.ts)
> - OpenAI adapter: [`apps/api/src/modules/ai/adapters/openai-provider.adapter.ts`](../../apps/api/src/modules/ai/adapters/openai-provider.adapter.ts)
> - Prompt registry: [`apps/api/src/modules/ai/prompts/prompt-registry.ts`](../../apps/api/src/modules/ai/prompts/prompt-registry.ts)
> - Concierge service: [`apps/api/src/modules/marketplace/services/ai-concierge.service.ts`](../../apps/api/src/modules/marketplace/services/ai-concierge.service.ts)
>
> The remainder of this document preserves the target architecture for planning and roadmap use.
> Update this table whenever a capability moves from ❌ to ✅.

---

# Prompt 3: AI Concierge Agent System — Target Architecture

## Executive Summary
This document specifies the highly concurrent, low-latency AI Concierge Agent architecture. Operating as the intelligent conversational layer of the Global Rental Platform, the agent orchestrates interactions between Renters, Hosts, and backend services. It abstracts complex multi-step processes (discovery, dispute, re-booking) behind an adaptive, multi-lingual natural language interface.

## 1. Agent Architecture & Orchestration

The system employs a multi-agent orchestration architecture (e.g., using LangChain or LlamaIndex), organized to route intents effectively:

1. **Router Agent (The Gateway):** Ingests the initial user query, classifies the intent (Discovery, Support, Dispute, Host Operations), and delegates the context to a specialized sub-agent.
2. **Specialized Sub-Agents:**
    *   **Discovery Agent:** Connected to the Multi-Modal Search (Prompt 6) to handle complex queries ("Find a pet-friendly cabin near a lake within 2 hours of Seattle, available next weekend, under $300/night").
    *   **Booking Agent:** Manages the conversational flow to lock inventory, initiate payments (Prompt 11), and verify identity via Policy Packs (Prompt 13).
    *   **Host Support Agent:** Assists hosts in drafting listing copy, dynamic pricing explanations, and Calendar management.
    *   **Dispute & Mediation Agent:** Integrates directly with the Dispute Resolution Platform (Prompt 15), gathering structured evidence via unstructured conversation.

## 2. Interaction Pipelines

The interaction pipeline emphasizes safety, speed, and real-time data access:

1. **Input Pre-processing:** Language detection, moderation (PII masking), and intent classification.
2. **Context Enrichment (RAG):**
    *   Fetches the user's booking history from the Domain Database (Prompt 1).
    *   Fetches dynamic localized constraints from the active Country Policy Pack (e.g., identity requirements for booking in Italy).
    *   Queries the `Real-Time Availability Graph` (Prompt 10) to strictly prevent hallucinated inventory.
3. **LLM Inference:** Generation of the response utilizing tools/functions (OpenAI Function Calling or similar).
4. **Action Execution:** The LLM's requested actions (e.g., `lock_availability`, `issue_refund`) are processed by intermediate security layers.
5. **Output Post-processing:** Localization and final safety checks.

## 3. Knowledge Integration Layer

To prevent hallucinations, the AI Concierge must be strictly grounded in platform state:
*   **Vector Database (Pinecone/Milvus):** Stores semantic embeddings of listing descriptions, host reviews, house rules, and global FAQ articles.
*   **Knowledge Graph Connection:** Connects directly to the Global Inventory Graph (Prompt 9) to navigate complex relationship queries (e.g., "Has this host ever had a cancellation?").
*   **Real-Time Data Streams:** Subscribes to changes from the Liquidity Engine (Prompt 2) to dynamically recommend discounted or high-availability inventory.

---

## Architecture Observations
- Relies heavily on **Tool Calling/Function Calling** paradigms rather than pure textual generation.
- The separation of intent routing ensures that safety-critical actions (Disputes) utilize highly deterministic, guarded prompts, while Discovery allows for more conversational creativity.
- Fully stateless agent backend; conversation history is serialized, encrypted, and retrieved per request.

## Extensibility Assessment
- **High:** New capabilities are simply registered as "Tools" with the LLM orchestrator. A new regional regulation (e.g., a specific tourist tax warning) can be seamlessly integrated into the context enrichment phase via the Policy Engine.

## Critical Findings
- **Severity: Blocker** - The AI must *never* execute destructive actions (cancellations, refunds, dispute bindings) without explicit, multi-factor user confirmation and secondary rule-engine validation.
- **Severity: Critical** - Latency. Standard LLM routing and RAG pipelines can introduce multi-second latency, unacceptable for a chat interface. We must employ streaming responses, sub-agent parallelization, and edge-deployed models where possible.