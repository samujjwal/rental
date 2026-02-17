import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReviewDirection {
  RENTER_TO_OWNER = 'RENTER_TO_OWNER',
  OWNER_TO_RENTER = 'OWNER_TO_RENTER',
}

export class CreateReviewDto {
  @ApiProperty({ description: 'Booking ID this review is for' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Direction of review', enum: ReviewDirection })
  @IsEnum(ReviewDirection)
  reviewType: ReviewDirection;

  @ApiProperty({ description: 'Overall rating', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({ description: 'Accuracy rating', required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  accuracyRating?: number;

  @ApiProperty({ description: 'Communication rating', required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @ApiProperty({ description: 'Cleanliness rating', required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @ApiProperty({ description: 'Value rating', required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @ApiProperty({ description: 'Review comment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateReviewDto {
  @ApiProperty({ description: 'Updated overall rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiProperty({ description: 'Updated accuracy rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  accuracyRating?: number;

  @ApiProperty({ description: 'Updated communication rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @ApiProperty({ description: 'Updated cleanliness rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @ApiProperty({ description: 'Updated value rating', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @ApiProperty({ description: 'Updated comment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
