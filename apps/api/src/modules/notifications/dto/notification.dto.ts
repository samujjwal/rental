import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'Enable email notifications', required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ description: 'Enable push notifications', required: false })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiProperty({ description: 'Enable SMS notifications', required: false })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiProperty({ description: 'Enable in-app notifications', required: false })
  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @ApiProperty({ description: 'Enable marketing emails', required: false })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiProperty({ description: 'Notification type preferences', required: false })
  @IsOptional()
  types?: {
    booking?: boolean;
    payment?: boolean;
    review?: boolean;
    message?: boolean;
    system?: boolean;
    organization?: boolean;
  };
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Device push notification token' })
  @IsString()
  @MaxLength(500)
  token: string;

  @ApiProperty({
    description: 'Device platform',
    enum: DevicePlatform,
    example: DevicePlatform.IOS,
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ description: 'Device name or identifier', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

export class UnregisterDeviceDto {
  @ApiProperty({ description: 'Device push notification token to unregister' })
  @IsString()
  @MaxLength(500)
  token: string;
}
