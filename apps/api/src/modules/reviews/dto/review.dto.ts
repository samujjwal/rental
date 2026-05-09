import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateReviewInput, UpdateReviewInput } from '@rental-portal/shared-types';

/**
 * Create Review DTO
 * Aligned with shared-types CreateReviewInput
 */
export class CreateReviewDto implements CreateReviewInput {
  @ApiProperty({ description: 'Booking ID this review is for' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Overall rating', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review comment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment: string;

  @ApiProperty({ description: 'Rating categories', required: false })
  @IsOptional()
  @IsObject()
  categories?: {
    accuracy?: number;
    communication?: number;
    cleanliness?: number;
    value?: number;
  };

  @ApiProperty({ 
    description: 'Direction of review', 
    enum: ['RENTER_TO_LISTING', 'OWNER_TO_RENTER'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['RENTER_TO_LISTING', 'OWNER_TO_RENTER'])
  direction?: 'RENTER_TO_LISTING' | 'OWNER_TO_RENTER';
}

/**
 * Update Review DTO
 * Aligned with shared-types UpdateReviewInput
 */
export class UpdateReviewDto implements UpdateReviewInput {
  @ApiProperty({ description: 'Updated overall rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ description: 'Updated comment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiProperty({ description: 'Rating categories', required: false })
  @IsOptional()
  @IsObject()
  categories?: {
    accuracy?: number;
    communication?: number;
    cleanliness?: number;
    value?: number;
  };
}
