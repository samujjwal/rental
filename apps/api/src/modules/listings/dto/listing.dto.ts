import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  MaxLength,
  Min,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PhotoDto {
  @ApiProperty({ description: 'Photo URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Display order' })
  @IsNumber()
  order: number;

  @ApiProperty({ description: 'Photo caption', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class VideoDto {
  @ApiProperty({ description: 'Video URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Video type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Thumbnail URL', required: false })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class CreateListingDto {
  @ApiProperty({ description: 'Category ID' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ description: 'Listing title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Listing description' })
  @IsString()
  @MaxLength(5000)
  description: string;

  // Location fields
  @ApiProperty({ description: 'Address line 1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiProperty({ description: 'Address line 2', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ description: 'State' })
  @IsString()
  @MaxLength(100)
  state: string;

  @ApiProperty({ description: 'Postal code', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @MaxLength(100)
  country: string;

  @ApiProperty({ description: 'Latitude' })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  @IsLongitude()
  longitude: number;

  // Media
  @ApiProperty({ description: 'Photos', required: false, type: [PhotoDto] })
  @IsOptional()
  @IsArray()
  @Type(() => PhotoDto)
  photos?: PhotoDto[];

  @ApiProperty({ description: 'Videos', required: false, type: [VideoDto] })
  @IsOptional()
  @IsArray()
  @Type(() => VideoDto)
  videos?: VideoDto[];

  // Pricing
  @ApiProperty({ description: 'Pricing mode (e.g., DAILY, HOURLY)' })
  @IsString()
  pricingMode: string;

  @ApiProperty({ description: 'Base price', minimum: 0 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ description: 'Hourly price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyPrice?: number;

  @ApiProperty({ description: 'Daily price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyPrice?: number;

  @ApiProperty({ description: 'Weekly price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyPrice?: number;

  @ApiProperty({ description: 'Monthly price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiProperty({ description: 'Currency code', required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  // Deposit
  @ApiProperty({ description: 'Whether deposit is required', required: false })
  @IsOptional()
  @IsBoolean()
  requiresDeposit?: boolean;

  @ApiProperty({ description: 'Deposit amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiProperty({ description: 'Deposit type', required: false })
  @IsOptional()
  @IsString()
  depositType?: string;

  // Booking settings
  @ApiProperty({ description: 'Booking mode (e.g., INSTANT, REQUEST)' })
  @IsString()
  bookingMode: string;

  @ApiProperty({ description: 'Minimum booking hours', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minBookingHours?: number;

  @ApiProperty({ description: 'Maximum booking days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBookingDays?: number;

  @ApiProperty({ description: 'Lead time in hours', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTime?: number;

  @ApiProperty({ description: 'Advance notice in hours', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceNotice?: number;

  @ApiProperty({ description: 'Capacity', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  // Category-specific
  @ApiProperty({ description: 'Category-specific data' })
  @IsObject()
  categorySpecificData: Record<string, any>;

  // Extra fields
  @ApiProperty({ description: 'Item condition', required: false })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiProperty({ description: 'Features list', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty({ description: 'Amenities', required: false })
  @IsOptional()
  @IsArray()
  amenities?: any[];

  @ApiProperty({ description: 'Rules', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rules?: string[];

  @ApiProperty({ description: 'SEO meta title', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiProperty({ description: 'SEO meta description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;
}

export class UpdateListingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pricingMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookingMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  categorySpecificData?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  amenities?: any[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rules?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  requiresDeposit?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  depositType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;
}
