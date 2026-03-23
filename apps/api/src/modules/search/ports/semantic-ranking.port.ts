/**
 * Port interface for semantic ranking within the Search domain.
 *
 * Search depends on this interface, not on any specific AI provider
 * implementation. This breaks the direct search → AI module coupling
 * and makes the semantic ranking adapter replaceable without touching
 * search logic.
 *
 * The concrete adapter (EmbeddingService from the AI module) is wired
 * via the SearchModule providers using the SEMANTIC_RANKING_PORT token.
 */
export interface SemanticRankingPort {
  /**
   * Return a ranked list of listing IDs matching the semantic query.
   * Results are ordered by ascending cosine distance (most similar first).
   */
  semanticSearch(
    query: string,
    limit: number,
    offset: number,
  ): Promise<Array<{ id: string; title: string; distance: number }>>;
}

export const SEMANTIC_RANKING_PORT = Symbol('SemanticRankingPort');
