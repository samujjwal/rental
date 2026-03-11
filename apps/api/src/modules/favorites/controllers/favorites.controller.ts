import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { FavoritesService } from '../services/favorites.service';

@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiResponse({ status: 200, description: 'Favorites retrieved' })
  async getFavorites(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: 'createdAt' | 'price' | 'title',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('category') category?: string,
  ) {
    return this.favoritesService.getFavorites(
      userId,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 20,
      sortBy || 'createdAt',
      sortOrder || 'desc',
      category,
    );
  }

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get favorite by listing ID (optional auth)' })
  @ApiResponse({ status: 200, description: 'Favorite retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  async getFavoriteByListingId(
    @Param('listingId') listingId: string,
    @Headers('authorization') authorization?: string,
  ) {
    if (!authorization) {
      return { favorited: false };
    }
    
    try {
      // Extract token from Authorization header
      const token = authorization.replace('Bearer ', '');
      // Decode the token to get the user ID
      const { JwtService } = require('@nestjs/jwt');
      const jwt = new JwtService({
        secret: process.env.JWT_SECRET || 'dev-secret',
      });
      const payload = jwt.verify(token) as { sub: string };
      const userId = payload.sub;
      
      return this.favoritesService.getFavoriteByListingId(userId, listingId);
    } catch {
      return { favorited: false };
    }
  }

  @Get('count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get favorites count' })
  @ApiResponse({ status: 200, description: 'Count retrieved' })
  async getFavoritesCount(@CurrentUser('id') userId: string) {
    const count = await this.favoritesService.countFavorites(userId);
    return { count };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add listing to favorites' })
  @ApiResponse({ status: 201, description: 'Favorite added' })
  async addFavorite(
    @CurrentUser('id') userId: string,
    @Body('listingId') listingId: string,
  ) {
    return this.favoritesService.addFavorite(userId, listingId);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk add favorites' })
  @ApiResponse({ status: 201, description: 'Favorites added' })
  async bulkAddFavorites(
    @CurrentUser('id') userId: string,
    @Body('listingIds') listingIds: string[],
  ) {
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      throw i18nBadRequest('validation.listingIdsRequired');
    }
    return this.favoritesService.bulkAddFavorites(userId, listingIds);
  }

  @Delete('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk remove favorites' })
  @ApiResponse({ status: 204, description: 'Favorites removed' })
  async bulkRemoveFavorites(
    @CurrentUser('id') userId: string,
    @Body('listingIds') listingIds: string[],
  ) {
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      throw i18nBadRequest('validation.listingIdsRequired');
    }
    await this.favoritesService.bulkRemoveFavorites(userId, listingIds);
  }

  @Delete('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all favorites' })
  @ApiResponse({ status: 204, description: 'Favorites cleared' })
  async clearAllFavorites(@CurrentUser('id') userId: string) {
    await this.favoritesService.clearAllFavorites(userId);
  }

  @Delete(':listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove listing from favorites' })
  @ApiResponse({ status: 204, description: 'Favorite removed' })
  async removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('listingId') listingId: string,
  ) {
    await this.favoritesService.removeFavorite(userId, listingId);
  }
}
