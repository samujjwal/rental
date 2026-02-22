import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateDescriptionDto {
  @ApiProperty({ description: 'Listing title', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Category name' })
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiProperty({ description: 'Item condition', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  condition?: string;

  @ApiProperty({ description: 'Features list', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty({ description: 'City/location', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiProperty({ description: 'Price hint for context', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  priceHint?: string;
}

export class GenerateDescriptionResult {
  description: string;
  highlights: string[];
  suggestedTags: string[];
}
