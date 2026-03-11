/**
 * Interface for embedding services, used by the scheduler to avoid
 * direct imports from modules/ai/ (which would be an upward dependency violation).
 */
export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  backfillEmbeddings(batchSize?: number): Promise<number>;
}

export const EMBEDDING_SERVICE = Symbol('EMBEDDING_SERVICE');
