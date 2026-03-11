import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { i18nNotFound, i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser } from '@/common/auth';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListingVersionService } from '../services/listing-version.service';

@ApiTags('Listing Versions')
@Controller('listings/:listingId/versions')
export class ListingVersionController {
  constructor(
    private readonly versionService: ListingVersionService,
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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a version snapshot of the listing' })
  @ApiResponse({ status: 201, description: 'Version snapshot created' })
  async createSnapshot(
    @Param('listingId') listingId: string,
    @CurrentUser('id') userId: string,
    @Query('notes') changeNotes?: string,
  ) {
    await this.verifyOwnership(listingId, userId);
    return this.versionService.createSnapshot({
      listingId,
      changedBy: userId,
      changeNotes,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all versions of a listing' })
  @ApiResponse({ status: 200, description: 'Paginated version list' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('listingId') listingId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.versionService.findAllForListing(
      listingId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the latest version number' })
  @ApiResponse({ status: 200, description: 'Latest version number' })
  async getLatestVersion(@Param('listingId') listingId: string) {
    const version = await this.versionService.getLatestVersion(listingId);
    return { version };
  }

  @Get(':version')
  @ApiOperation({ summary: 'Get a specific version snapshot' })
  @ApiResponse({ status: 200, description: 'Version snapshot with full data' })
  async findVersion(
    @Param('listingId') listingId: string,
    @Param('version') version: string,
  ) {
    return this.versionService.findVersion(listingId, parseInt(version, 10));
  }

  @Get(':versionA/diff/:versionB')
  @ApiOperation({ summary: 'Compare two versions of a listing' })
  @ApiResponse({ status: 200, description: 'Diff between two versions' })
  async diffVersions(
    @Param('listingId') listingId: string,
    @Param('versionA') versionA: string,
    @Param('versionB') versionB: string,
  ) {
    return this.versionService.diffVersions(
      listingId,
      parseInt(versionA, 10),
      parseInt(versionB, 10),
    );
  }
}
