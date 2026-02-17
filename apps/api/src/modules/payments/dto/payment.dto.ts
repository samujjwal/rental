import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartOnboardingDto {
  @ApiProperty({ description: 'URL to redirect user after onboarding' })
  @IsUrl()
  @IsNotEmpty()
  returnUrl: string;

  @ApiProperty({ description: 'URL to redirect user if onboarding link expires' })
  @IsUrl()
  @IsNotEmpty()
  refreshUrl: string;
}

export class AttachPaymentMethodDto {
  @ApiProperty({ description: 'Stripe payment method ID' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}

export class RequestPayoutDto {
  @ApiProperty({ description: 'Payout amount (optional, defaults to full balance)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class RequestRefundDto {
  @ApiProperty({ description: 'Refund amount in currency units (optional, defaults to full)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ description: 'Reason for refund', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
