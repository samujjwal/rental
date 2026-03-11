import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateListingContentDto {
  listingId: string;
  locale: string;
  title: string;
  description: string;
  rules?: string;
  highlights?: string[];
}

export interface UpdateListingContentDto {
  title?: string;
  description?: string;
  rules?: string;
  highlights?: string[];
}

@Injectable()
export class ListingContentService {
  private readonly logger = new Logger(ListingContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update content for a listing in a given locale.
   * Uses upsert to avoid conflicts on (listingId, locale) unique constraint.
   */
  async upsert(
    listingId: string,
    locale: string,
    dto: CreateListingContentDto | UpdateListingContentDto,
  ) {
    await this.ensureListingExists(listingId);

    const data = {
      title: (dto as CreateListingContentDto).title,
      description: (dto as CreateListingContentDto).description,
      rules: dto.rules ?? null,
      highlights: dto.highlights ? JSON.stringify(dto.highlights) : null,
    };

    return this.prisma.listingContent.upsert({
      where: {
        listingId_locale: { listingId, locale },
      },
      create: {
        listingId,
        locale,
        ...data,
      },
      update: {
        // Only update fields that are provided
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.rules !== undefined && { rules: data.rules }),
        ...(data.highlights !== undefined && { highlights: data.highlights }),
      },
    });
  }

  /**
   * Get all content entries for a listing (all locales).
   */
  async findAllForListing(listingId: string) {
    return this.prisma.listingContent.findMany({
      where: { listingId },
      orderBy: { locale: 'asc' },
    });
  }

  /**
   * Get content for a specific locale. Falls back to 'en' if not found.
   */
  async findByLocale(listingId: string, locale: string) {
    const content = await this.prisma.listingContent.findUnique({
      where: {
        listingId_locale: { listingId, locale },
      },
    });

    if (content) return content;

    // Fallback to English
    if (locale !== 'en') {
      const fallback = await this.prisma.listingContent.findUnique({
        where: {
          listingId_locale: { listingId, locale: 'en' },
        },
      });
      if (fallback) return { ...fallback, _fallbackLocale: 'en' };
    }

    return null;
  }

  /**
   * Delete content for a specific locale.
   * Cannot delete 'en' if it's the only locale remaining.
   */
  async deleteByLocale(listingId: string, locale: string) {
    if (locale === 'en') {
      const count = await this.prisma.listingContent.count({
        where: { listingId },
      });
      if (count <= 1) {
        throw new ConflictException(
          'Cannot delete the only remaining content locale (en)',
        );
      }
    }

    const content = await this.prisma.listingContent.findUnique({
      where: {
        listingId_locale: { listingId, locale },
      },
    });

    if (!content) {
      throw new NotFoundException(
        `Content for locale '${locale}' not found on listing ${listingId}`,
      );
    }

    return this.prisma.listingContent.delete({
      where: {
        listingId_locale: { listingId, locale },
      },
    });
  }

  /**
   * List available locales for a listing.
   */
  async getAvailableLocales(listingId: string): Promise<string[]> {
    const contents = await this.prisma.listingContent.findMany({
      where: { listingId },
      select: { locale: true },
    });
    return contents.map((c) => c.locale);
  }

  private async ensureListingExists(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
  }
}
