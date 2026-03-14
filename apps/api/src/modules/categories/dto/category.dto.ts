import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsArray,
  IsEnum,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PricingMode } from '@rental-portal/database';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiProperty({ description: 'Category description', required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Icon URL or icon name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  iconUrl?: string;

  @ApiProperty({ description: 'Parent category ID (for subcategories)', required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'Display order', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({ description: 'Template schema for category-specific fields (JSON)' })
  @IsObject()
  templateSchema: Record<string, any>;

  @ApiProperty({ description: 'Searchable fields list', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchableFields?: string[];

  @ApiProperty({ description: 'Required fields list', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @ApiProperty({ description: 'Default pricing mode', required: false, enum: PricingMode })
  @IsOptional()
  @IsEnum(PricingMode)
  defaultPricingMode?: PricingMode;

  @ApiProperty({ description: 'Allow instant booking', required: false })
  @IsOptional()
  @IsBoolean()
  allowInstantBook?: boolean;

  @ApiProperty({ description: 'Require deposit by default', required: false })
  @IsOptional()
  @IsBoolean()
  requiresDepositDefault?: boolean;

  @ApiProperty({ description: 'Default deposit percentage', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDepositPercentage?: number;

  @ApiProperty({ description: 'Require insurance', required: false })
  @IsOptional()
  @IsBoolean()
  insuranceRequired?: boolean;

  @ApiProperty({ description: 'Minimum insurance amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumInsuranceAmount?: number;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  iconUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  templateSchema?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchableFields?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ required: false, enum: PricingMode })
  @IsOptional()
  @IsEnum(PricingMode)
  defaultPricingMode?: PricingMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowInstantBook?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  requiresDepositDefault?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDepositPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  insuranceRequired?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumInsuranceAmount?: number;
}
