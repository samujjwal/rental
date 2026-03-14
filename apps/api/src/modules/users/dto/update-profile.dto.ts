import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'First name', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    required: false,
    example: '+12025551234',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format (e.g. +12025551234)',
  })
  phoneNumber?: string;

  @ApiProperty({ description: 'Short biography', required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @ApiProperty({ description: 'Profile photo URL', required: false })
  @IsOptional()
  @IsUrl({}, { message: 'Profile photo must be a valid URL' })
  profilePhotoUrl?: string;

  @ApiProperty({ description: 'Date of birth', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Address line 1', required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiProperty({ description: 'Address line 2', required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty({ description: 'City', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'State or province', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ description: 'Postal/zip code', required: false, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ description: 'Country', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ description: 'Timezone (IANA)', required: false, example: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiProperty({ description: 'Preferred language', required: false, example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLanguage?: string;

  @ApiProperty({ description: 'Preferred currency (ISO 4217)', required: false, example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  preferredCurrency?: string;
}
