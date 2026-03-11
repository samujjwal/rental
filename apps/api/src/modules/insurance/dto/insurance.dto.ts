import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InsuranceType, InsuranceStatus } from '@rental-portal/database';

export class CreatePolicyDto {
  @ApiProperty({ description: 'Policy number (unique identifier from provider)' })
  @IsString()
  @MaxLength(100)
  policyNumber: string;

  @ApiProperty({ description: 'Associated booking ID', required: false })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiProperty({ description: 'Associated listing (property) ID' })
  @IsUUID()
  propertyId: string;

  @ApiProperty({ description: 'Insurance type', enum: InsuranceType })
  @IsEnum(InsuranceType)
  type: InsuranceType;

  @ApiProperty({ description: 'Insurance provider name' })
  @IsString()
  @MaxLength(200)
  provider: string;

  @ApiProperty({ description: 'Coverage amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  coverage: number;

  @ApiProperty({ description: 'Coverage amount (alias)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  coverageAmount?: number;

  @ApiProperty({ description: 'Premium amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ description: 'Policy start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Policy end date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Supporting document URLs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];
}

export class VerifyPolicyDto {
  @ApiProperty({ description: 'Verification status', enum: InsuranceStatus })
  @IsEnum(InsuranceStatus)
  status: InsuranceStatus;

  @ApiProperty({ description: 'Verification notes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UploadPolicyDto {
  @ApiProperty({ description: 'Listing ID' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'Policy number' })
  @IsString()
  @MaxLength(100)
  policyNumber: string;

  @ApiProperty({ description: 'Insurance provider' })
  @IsString()
  @MaxLength(200)
  provider: string;

  @ApiProperty({ description: 'Insurance type' })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({ description: 'Coverage amount' })
  @IsNumber()
  @Min(0)
  coverageAmount: number;

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ description: 'Expiration date' })
  @IsDateString()
  expirationDate: string;

  @ApiProperty({ description: 'Document URL' })
  @IsString()
  @MaxLength(2000)
  documentUrl: string;
}

export class CreateClaimDto {
  @ApiProperty({ description: 'Insurance policy ID' })
  @IsUUID()
  policyId: string;

  @ApiProperty({ description: 'Associated booking ID', required: false })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiProperty({ description: 'Claim amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  claimAmount: number;

  @ApiProperty({ description: 'Description of the claim' })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty({ description: 'Date of incident' })
  @IsDateString()
  incidentDate: string;

  @ApiProperty({ description: 'Supporting document URLs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
