import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewsService, CreateReviewDto, UpdateReviewDto } from '../services/reviews.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or booking not completed' })
  @ApiResponse({ status: 403, description: 'Not authorized to review this booking' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({ status: 200, description: 'Review retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async getReview(@Param('id') id: string) {
    return this.reviewsService.getReview(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update review (within 7 days)' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 400, description: 'Review can no longer be edited' })
  @ApiResponse({ status: 403, description: 'Can only update your own reviews' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete review' })
  @ApiResponse({ status: 204, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Can only delete your own reviews' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.reviewsService.delete(id, userId);
  }

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get listing reviews' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getListingReviews(
    @Param('listingId') listingId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getListingReviews(listingId, page, limit);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user reviews' })
  @ApiQuery({ name: 'type', required: true, enum: ['received', 'given'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getUserReviews(
    @Param('userId') userId: string,
    @Query('type') type: 'received' | 'given',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getUserReviews(userId, type, page, limit);
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking reviews (both directions)' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getBookingReviews(@Param('bookingId') bookingId: string) {
    return this.reviewsService.getBookingReviews(bookingId);
  }

  @Get('booking/:bookingId/can-review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user can review booking' })
  @ApiResponse({ status: 200, description: 'Review eligibility checked' })
  async canReviewBooking(@Param('bookingId') bookingId: string, @CurrentUser('id') userId: string) {
    return this.reviewsService.canUserReviewBooking(userId, bookingId);
  }
}
