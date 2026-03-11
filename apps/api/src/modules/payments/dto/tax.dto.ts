import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  state: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2)
  country: string;
}

export class CalculateTaxDto {
  @ApiProperty({ description: 'Amount to calculate tax for' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ description: 'Customer address' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  customerAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Business address' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  businessAddress?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;
}

export class CreateTaxTransactionDto {
  @ApiProperty({ description: 'Stripe payment intent ID' })
  @IsString()
  paymentIntentId: string;

  @ApiPropertyOptional({ description: 'Tax calculation ID' })
  @IsOptional()
  @IsString()
  taxCalculationId?: string;
}

export class RegisterForTaxDto {
  @ApiProperty({ description: 'Country code' })
  @IsString()
  @MaxLength(2)
  country: string;

  @ApiPropertyOptional({ description: 'State/province code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  state?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;
}

export class Generate1099Dto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Tax year' })
  @IsNumber()
  @Min(2020)
  year: number;
}
