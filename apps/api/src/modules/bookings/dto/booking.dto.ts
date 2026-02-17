import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Listing ID to book' })
  @IsString()
  listingId: string;

  @ApiProperty({ description: 'Start date of booking', example: '2025-03-01T00:00:00Z' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ description: 'End date of booking', example: '2025-03-05T00:00:00Z' })
  @IsDateString()
  endDate: Date;

  @ApiProperty({ description: 'Number of guests', required: false, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount?: number;

  @ApiProperty({ description: 'Message to the owner', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiProperty({ description: 'Promo code', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}

export class UpdateBookingDto {
  @ApiProperty({ description: 'Updated start date', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ description: 'Updated end date', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiProperty({ description: 'Updated guest count', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount?: number;

  @ApiProperty({ description: 'Updated message', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class RejectBookingDto {
  @ApiProperty({ description: 'Reason for rejection', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CancelBookingDto {
  @ApiProperty({ description: 'Reason for cancellation', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class InitiateDisputeDto {
  @ApiProperty({ description: 'Reason for the dispute' })
  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class CalculatePriceDto {
  @ApiProperty({ description: 'Listing ID' })
  @IsString()
  listingId: string;

  @ApiProperty({ description: 'Start date', example: '2025-03-01T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2025-03-05T00:00:00Z' })
  @IsDateString()
  endDate: string;
}
