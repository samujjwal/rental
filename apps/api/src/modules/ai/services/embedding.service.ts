import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { SemanticRankingPort } from '@/modules/search/ports/semantic-ranking.port';

/**
 * Service for generating and managing vector embeddings for semantic search.
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions).
 *
 * Implements SemanticRankingPort so the Search domain can consume embedding-backed
 * semantic ranking without depending on this class directly.
 */
@Injectable()
export class EmbeddingService implements SemanticRankingPort {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string | undefined;
  private readonly embeddingModel = 'text-embedding-3-small';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY');
  }

  /**
   * Generate an embedding vector from text using OpenAI.
   * Returns null if API key is not configured.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey) {
      this.logger.debug('OPENAI_API_KEY not set, skipping embedding generation');
      return null;
    }

    // Truncate to ~8000 tokens (~32000 chars) to stay within model limits
    const truncated = text.slice(0, 32000);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: truncated,
        }),
      });

      if (!response.ok) {
        this.logger.error(`OpenAI embedding API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data?.data?.[0]?.embedding || null;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      return null;
    }
  }

  /**
   * Build a text representation of a listing for embedding.
   */
  buildListingText(listing: {
    title: string;
    description?: string | null;
    city?: string;
    category?: { name: string } | null;
    features?: string[];
    amenities?: string[];
  }): string {
    const parts = [listing.title];
    if (listing.description) parts.push(listing.description);
    if (listing.city) parts.push(`Located in ${listing.city}`);
    if (listing.category?.name) parts.push(`Category: ${listing.category.name}`);
    if (listing.features?.length) parts.push(`Features: ${listing.features.join(', ')}`);
    if (listing.amenities?.length) parts.push(`Amenities: ${listing.amenities.join(', ')}`);
    return parts.join('. ');
  }

  /**
   * Update the embedding for a single listing.
   */
  async updateListingEmbedding(listingId: string): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        features: true,
        amenities: true,
        category: { select: { name: true } },
      },
    });

    if (!listing) return false;

    const text = this.buildListingText(listing);
    const embedding = await this.generateEmbedding(text);
    if (!embedding) return false;

    // Use raw SQL since Prisma doesn't support vector types directly
    const vectorStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE properties SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      listingId,
    );

    this.logger.debug(`Updated embedding for listing ${listingId}`);
    return true;
  }

  /**
   * Semantic search: find listings similar to a query string.
   * Uses cosine distance on the embedding vector.
   */
  async semanticSearch(
    query: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Array<{ id: string; title: string; distance: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) {
      this.logger.warn('Cannot perform semantic search without embedding');
      return [];
    }

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // Use cosine distance operator (<=>)
    const results: Array<{ id: string; title: string; distance: number }> =
      await this.prisma.$queryRawUnsafe(
        `SELECT id, title, (embedding <=> $1::vector) as distance
         FROM properties
         WHERE embedding IS NOT NULL
           AND status = 'AVAILABLE'
           AND "verificationStatus" = 'VERIFIED'
         ORDER BY embedding <=> $1::vector
         LIMIT $2 OFFSET $3`,
        vectorStr,
        limit,
        offset,
      );

    return results;
  }

  /**
   * Batch-update embeddings for all listings that don't have one yet.
   * Processes in chunks to avoid rate limits.
   */
  async backfillEmbeddings(batchSize: number = 50): Promise<number> {
    // Find listings without embeddings
    const listings: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM properties WHERE embedding IS NULL AND status = 'AVAILABLE' LIMIT $1`,
      batchSize,
    );

    let count = 0;
    for (const { id } of listings) {
      const success = await this.updateListingEmbedding(id);
      if (success) count++;
      // Simple rate limiting: ~60 req/min for embeddings API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(`Backfilled ${count}/${listings.length} listing embeddings`);
    return count;
  }
}
