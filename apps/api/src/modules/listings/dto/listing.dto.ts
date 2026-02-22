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
  @ApiProperty({ description: 'Category ID', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

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

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ description: 'Postal code', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ description: 'Latitude', required: false })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiProperty({ description: 'Longitude', required: false })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

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
  @ApiProperty({ description: 'Pricing mode (e.g., DAILY, HOURLY)', required: false })
  @IsOptional()
  @IsString()
  pricingMode?: string;

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
  @ApiProperty({ description: 'Booking mode (e.g., INSTANT, REQUEST)', required: false })
  @IsOptional()
  @IsString()
  bookingMode?: string;

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
  @ApiProperty({ description: 'Category-specific data', required: false })
  @IsOptional()
  @IsObject()
  categorySpecificData?: Record<string, any>;

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

  // ── Frontend-compatible aliases ───────────────────────────────
  // The SPA sends a nested `location` object and flat image URLs.
  // Accept them so the ValidationPipe doesn't reject the request.

  @ApiProperty({ description: 'Category (alias for categoryId)', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Subcategory', required: false })
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiProperty({ description: 'Nested location object from frontend', required: false })
  @IsOptional()
  @IsObject()
  location?: Record<string, any>;

  @ApiProperty({ description: 'Image URLs (frontend format)', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ description: 'Enable instant booking (frontend alias)', required: false })
  @IsOptional()
  @IsBoolean()
  instantBooking?: boolean;

  @ApiProperty({ description: 'Security deposit (frontend alias)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  securityDeposit?: number;

  @ApiProperty({ description: 'Delivery options (frontend format)', required: false })
  @IsOptional()
  @IsObject()
  deliveryOptions?: Record<string, boolean>;

  @ApiProperty({ description: 'Delivery radius in km', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadius?: number;

  @ApiProperty({ description: 'Delivery fee', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiProperty({ description: 'Minimum rental period in days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumRentalPeriod?: number;

  @ApiProperty({ description: 'Maximum rental period in days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maximumRentalPeriod?: number;

  @ApiProperty({ description: 'Cancellation policy', required: false })
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiProperty({ description: 'Price per day (alias)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerDay?: number;

  @ApiProperty({ description: 'Price per week (frontend alias)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerWeek?: number;

  @ApiProperty({ description: 'Price per month (frontend alias)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMonth?: number;
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

  // ── Frontend-compatible aliases ───────────────────────────────

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  location?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  instantBooking?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  securityDeposit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  deliveryOptions?: Record<string, boolean>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadius?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumRentalPeriod?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maximumRentalPeriod?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerWeek?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMonth?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subcategory?: string;
}
