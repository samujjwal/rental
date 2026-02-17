import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus } from '@rental-portal/database';

export enum DisputeType {
  PROPERTY_DAMAGE = 'PROPERTY_DAMAGE',
  MISSING_ITEMS = 'MISSING_ITEMS',
  CONDITION_MISMATCH = 'CONDITION_MISMATCH',
  REFUND_REQUEST = 'REFUND_REQUEST',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  OTHER = 'OTHER',
}

export class CreateDisputeDto {
  @ApiProperty({ description: 'Booking ID for the dispute' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Dispute title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Type of dispute', enum: DisputeType })
  @IsEnum(DisputeType)
  type: DisputeType;

  @ApiProperty({ description: 'Detailed description of the dispute' })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiProperty({ description: 'URLs of evidence files', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @ApiProperty({ description: 'Disputed amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class UpdateDisputeDto {
  @ApiProperty({ description: 'Updated dispute status', required: false, enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiProperty({ description: 'Resolution description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolution?: string;

  @ApiProperty({ description: 'Resolved amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  resolvedAmount?: number;

  @ApiProperty({ description: 'Admin notes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class AddEvidenceDto {
  @ApiProperty({ description: 'Evidence description' })
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ description: 'File URLs' })
  @IsArray()
  @IsString({ each: true })
  files: string[];
}

export class AddResponseDto {
  @ApiProperty({ description: 'Response message' })
  @IsString()
  @MaxLength(5000)
  message: string;

  @ApiProperty({ description: 'Evidence URLs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}

export class CloseDisputeDto {
  @ApiProperty({ description: 'Reason for closing the dispute' })
  @IsString()
  @MaxLength(2000)
  reason: string;
}
