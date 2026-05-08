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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser } from '@/common/auth';
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
  ) {}

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
    await this.contentService.verifyOwnership(listingId, userId);
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
    await this.contentService.verifyOwnership(listingId, userId);
    await this.contentService.deleteByLocale(listingId, locale);
  }
}
