import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { i18nNotFound, i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser } from '@/common/auth';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  ListingContentService,
  CreateListingContentDto,
  UpdateListingContentDto,
} from '../services/listing-content.service';

@ApiTags('Listing Content (i18n)')
@Controller('listings/:listingId/content')
export class ListingContentController {
  constructor(
    private readonly contentService: ListingContentService,
    private readonly prisma: PrismaService,
  ) {}

  private async verifyOwnership(listingId: string, userId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw i18nNotFound('listing.notFound');
    if (listing.ownerId !== userId) throw i18nForbidden('listing.unauthorized');
  }

  @Put(':locale')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update listing content for a locale' })
  @ApiResponse({ status: 200, description: 'Content upserted' })
  async upsert(
    @Param('listingId') listingId: string,
    @Param('locale') locale: string,
    @Body() body: Omit<CreateListingContentDto, 'listingId' | 'locale'>,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyOwnership(listingId, userId);
    return this.contentService.upsert(listingId, locale, {
      ...body,
      listingId,
      locale,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all content locales for a listing' })
  @ApiResponse({ status: 200, description: 'List of content entries' })
  async findAll(@Param('listingId') listingId: string) {
    return this.contentService.findAllForListing(listingId);
  }

  @Get('locales')
  @ApiOperation({ summary: 'Get available locales for a listing' })
  @ApiResponse({ status: 200, description: 'List of locale codes' })
  async getLocales(@Param('listingId') listingId: string) {
    return this.contentService.getAvailableLocales(listingId);
  }

  @Get(':locale')
  @ApiOperation({ summary: 'Get content for a specific locale (fallback to en)' })
  @ApiResponse({ status: 200, description: 'Listing content' })
  async findByLocale(
    @Param('listingId') listingId: string,
    @Param('locale') locale: string,
  ) {
    return this.contentService.findByLocale(listingId, locale);
  }

  @Delete(':locale')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete content for a specific locale' })
  @ApiResponse({ status: 204, description: 'Content deleted' })
  async deleteByLocale(
    @Param('listingId') listingId: string,
    @Param('locale') locale: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyOwnership(listingId, userId);
    await this.contentService.deleteByLocale(listingId, locale);
  }
}
