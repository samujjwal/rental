import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Listing } from '@rental-portal/database';

@Injectable()
export class SearchIndexService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexService.name);
  private readonly indexName = 'listings';

  constructor(
    private readonly elasticsearch: ElasticsearchService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.createIndexIfNotExists();
  }

  private async createIndexIfNotExists() {
    try {
      const exists = await this.elasticsearch.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.createIndex();
        this.logger.log(`Created index: ${this.indexName}`);
      }
    } catch (error) {
      this.logger.error('Failed to check/create index', error);
    }
  }

  async createIndex() {
    await this.elasticsearch.indices.create({
      index: this.indexName,
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        analysis: {
          analyzer: {
            autocomplete: {
              type: 'custom',
              tokenizer: 'autocomplete',
              filter: ['lowercase'],
            },
            autocomplete_search: {
              type: 'custom',
              tokenizer: 'lowercase',
            },
          },
          tokenizer: {
            autocomplete: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 10,
              token_chars: ['letter', 'digit'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'autocomplete',
            search_analyzer: 'autocomplete_search',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          description: { type: 'text' },
          slug: { type: 'keyword' },
          categoryId: { type: 'keyword' },
          categoryName: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          categorySlug: { type: 'keyword' },
          city: { type: 'keyword' },
          state: { type: 'keyword' },
          country: { type: 'keyword' },
          location: { type: 'geo_point' },
          basePrice: { type: 'float' },
          hourlyPrice: { type: 'float' },
          dailyPrice: { type: 'float' },
          weeklyPrice: { type: 'float' },
          monthlyPrice: { type: 'float' },
          securityDeposit: { type: 'float' },
          currency: { type: 'keyword' },
          status: { type: 'keyword' },
          averageRating: { type: 'float' },
          reviewCount: { type: 'integer' },
          totalBookings: { type: 'integer' },
          ownerId: { type: 'keyword' },
          ownerName: { type: 'text' },
          ownerRating: { type: 'float' },
          amenities: { type: 'keyword' },
          rules: { type: 'text' },
          tags: { type: 'keyword' },
          availability: { type: 'object' },
          images: { type: 'object' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    });
  }

  async indexListing(listing: Listing | any) {
    try {
      const document = await this.prepareDocument(listing);

      await this.elasticsearch.index({
        index: this.indexName,
        id: listing.id,
        document: document,
        refresh: 'wait_for',
      });

      this.logger.log(`Indexed listing: ${listing.id}`);
    } catch (error) {
      this.logger.error(`Failed to index listing ${listing.id}`, error);
      throw error;
    }
  }

  async updateListing(listingId: string) {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              averageRating: true,
            },
          },
          category: true,
        },
      });

      if (!listing) {
        this.logger.warn(`Listing ${listingId} not found for indexing`);
        return;
      }

      await this.indexListing(listing);
    } catch (error) {
      this.logger.error(`Failed to update listing ${listingId}`, error);
    }
  }

  async removeListing(listingId: string) {
    try {
      await this.elasticsearch.delete({
        index: this.indexName,
        id: listingId,
      });

      this.logger.log(`Removed listing from index: ${listingId}`);
    } catch (error) {
      if ((error as any).meta?.statusCode !== 404) {
        this.logger.error(`Failed to remove listing ${listingId}`, error);
      }
    }
  }

  async bulkIndex(listings: (Listing | any)[]) {
    if (listings.length === 0) return;

    try {
      const operations = [];

      for (const listing of listings) {
        const document = await this.prepareDocument(listing);

        operations.push({ index: { _index: this.indexName, _id: listing.id } }, document);
      }

      const response = await this.elasticsearch.bulk({
        body: operations,
        refresh: 'wait_for',
      });

      if (response.errors) {
        const errors = response.items
          .filter((item: any) => item.index?.error)
          .map((item: any) => item.index.error);
        this.logger.error('Bulk indexing errors', errors);
      }

      this.logger.log(`Bulk indexed ${listings.length} listings`);
    } catch (error) {
      this.logger.error('Bulk indexing failed', error);
      throw error;
    }
  }

  async reindexAll() {
    try {
      this.logger.log('Starting full reindex...');

      // Delete existing index
      const exists = await this.elasticsearch.indices.exists({
        index: this.indexName,
      });

      if (exists) {
        await this.elasticsearch.indices.delete({ index: this.indexName });
      }

      // Create new index
      await this.createIndex();

      // Fetch all active listings
      const listings = await this.prisma.listing.findMany({
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              averageRating: true,
            },
          },
          category: true,
        },
      });

      // Bulk index in batches of 500
      const batchSize = 500;
      for (let i = 0; i < listings.length; i += batchSize) {
        const batch = listings.slice(i, i + batchSize);
        await this.bulkIndex(batch);
        this.logger.log(`Indexed batch ${i / batchSize + 1} (${batch.length} listings)`);
      }

      this.logger.log(`Reindex completed. Total: ${listings.length} listings`);
    } catch (error) {
      this.logger.error('Reindex failed', error);
      throw error;
    }
  }

  private async prepareDocument(listing: any) {
    const owner = listing.owner || {};
    const category = listing.category || {};

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      slug: listing.slug,
      categoryId: listing.categoryId,
      categoryName: category.name || '',
      categorySlug: category.slug || '',
      city: listing.city,
      state: listing.state,
      country: listing.country,
      location: {
        lat: listing.latitude,
        lon: listing.longitude,
      },
      basePrice: listing.basePrice,
      hourlyPrice: listing.hourlyPrice,
      dailyPrice: listing.dailyPrice,
      weeklyPrice: listing.weeklyPrice,
      monthlyPrice: listing.monthlyPrice,
      currency: listing.currency,
      pricingMode: listing.pricingMode,
      bookingMode: listing.bookingMode,
      status: listing.status,
      verificationStatus: listing.verificationStatus,
      condition: listing.condition,
      features: listing.features || [],
      amenities: listing.amenities ? listing.amenities.map((a: any) => a.name || a) : [],
      photos: listing.photos || [],
      ownerId: listing.ownerId,
      ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim(),
      ownerRating: owner.averageRating || 0,
      averageRating: listing.averageRating || 0,
      totalReviews: listing.totalReviews || 0,
      viewCount: listing.viewCount || 0,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  async getIndexStats() {
    try {
      const stats = await this.elasticsearch.indices.stats({
        index: this.indexName,
      });

      return {
        index: this.indexName,
        documentCount: (stats.indices as any)?.[this.indexName]?.total?.docs?.count || 0,
        indexSize: (stats.indices as any)?.[this.indexName]?.total?.store?.size_in_bytes || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get index stats', error);
      return null;
    }
  }
}
