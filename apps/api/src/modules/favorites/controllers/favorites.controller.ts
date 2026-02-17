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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { FavoritesService } from '../services/favorites.service';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
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
  @ApiOperation({ summary: 'Get favorite by listing ID' })
  @ApiResponse({ status: 200, description: 'Favorite retrieved' })
  async getFavoriteByListingId(
    @CurrentUser('id') userId: string,
    @Param('listingId') listingId: string,
  ) {
    return this.favoritesService.getFavoriteByListingId(userId, listingId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get favorites count' })
  @ApiResponse({ status: 200, description: 'Count retrieved' })
  async getFavoritesCount(@CurrentUser('id') userId: string) {
    const count = await this.favoritesService.countFavorites(userId);
    return { count };
  }

  @Post()
  @ApiOperation({ summary: 'Add listing to favorites' })
  @ApiResponse({ status: 201, description: 'Favorite added' })
  async addFavorite(
    @CurrentUser('id') userId: string,
    @Body('listingId') listingId: string,
  ) {
    return this.favoritesService.addFavorite(userId, listingId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk add favorites' })
  @ApiResponse({ status: 201, description: 'Favorites added' })
  async bulkAddFavorites(
    @CurrentUser('id') userId: string,
    @Body('listingIds') listingIds: string[],
  ) {
    return this.favoritesService.bulkAddFavorites(userId, listingIds || []);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove listing from favorites' })
  @ApiResponse({ status: 204, description: 'Favorite removed' })
  async removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('listingId') listingId: string,
  ) {
    await this.favoritesService.removeFavorite(userId, listingId);
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk remove favorites' })
  @ApiResponse({ status: 204, description: 'Favorites removed' })
  async bulkRemoveFavorites(
    @CurrentUser('id') userId: string,
    @Body('listingIds') listingIds: string[],
  ) {
    await this.favoritesService.bulkRemoveFavorites(userId, listingIds || []);
  }

  @Delete('all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all favorites' })
  @ApiResponse({ status: 204, description: 'Favorites cleared' })
  async clearAllFavorites(@CurrentUser('id') userId: string) {
    await this.favoritesService.clearAllFavorites(userId);
  }
}
