import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MaxLength,
  IsObject,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '@rental-portal/database';

export enum BusinessType {
  INDIVIDUAL = 'INDIVIDUAL',
  LLC = 'LLC',
  CORPORATION = 'CORPORATION',
  PARTNERSHIP = 'PARTNERSHIP',
}

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Organization description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Business type', enum: BusinessType })
  @IsEnum(BusinessType)
  businessType: BusinessType;

  @ApiProperty({ description: 'Tax ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiProperty({ description: 'Contact email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

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
}

export class UpdateOrganizationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Organization website URL', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

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
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ description: 'Organization settings', required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class InviteMemberDto {
  @ApiProperty({ description: 'Email of the member to invite' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Role for the invited member', enum: OrganizationRole })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}
