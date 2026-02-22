import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@rental-portal/database';

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'New user role', enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateEntityStatusDto {
  @ApiProperty({ description: 'New status' })
  @IsString()
  @MaxLength(50)
  status: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filters (JSON object)' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}

export class SuspendUserDto {
  @ApiProperty({ description: 'Reason for suspension' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class AdminActionDto {
  @ApiProperty({ description: 'Action type' })
  @IsString()
  @MaxLength(50)
  action: string;

  @ApiPropertyOptional({ description: 'Action reason' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
