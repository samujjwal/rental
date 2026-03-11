import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  bookingUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  messageNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewReminders?: boolean;
}
