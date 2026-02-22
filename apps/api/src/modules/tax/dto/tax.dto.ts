import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddressDto {
  @ApiProperty({ description: 'Street address line 1' })
  @IsString()
  line1: string;

  @ApiProperty({ description: 'Street address line 2', required: false })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'State/province' })
  @IsString()
  state: string;

  @ApiProperty({ description: 'Postal/zip code' })
  @IsString()
  postalCode: string;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)', example: 'US' })
  @IsString()
  country: string;
}

export class TaxLineItemDto {
  @ApiProperty({ description: 'Amount for this line item' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Tax code', required: false })
  @IsOptional()
  @IsString()
  taxCode?: string;
}

export class CalculateTaxDto {
  @ApiProperty({ description: 'Total amount to calculate tax on' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Origin address' })
  @ValidateNested()
  @Type(() => AddressDto)
  fromAddress: AddressDto;

  @ApiProperty({ description: 'Destination address' })
  @ValidateNested()
  @Type(() => AddressDto)
  toAddress: AddressDto;

  @ApiProperty({ description: 'Line items', required: false, type: [TaxLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxLineItemDto)
  lineItems?: TaxLineItemDto[];
}

export class CreateTaxTransactionDto {
  @ApiProperty({ description: 'Booking ID' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Tax amounts breakdown' })
  @IsObject()
  amounts: {
    stateTax: number;
    localTax: number;
    platformFees: number;
    totalTax: number;
  };
}

export class TaxRegistrationDto {
  @ApiProperty({ description: 'Tax jurisdictions to register for' })
  @IsArray()
  @IsString({ each: true })
  jurisdictions: string[];

  @ApiProperty({ description: 'Tax identification numbers', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taxIds?: string[];
}
