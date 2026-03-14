import { IsString, IsEnum, IsOptional, IsArray, IsIn } from 'class-validator';
import { NotificationType } from '@rental-portal/database';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsIn(['EMAIL', 'SMS', 'PUSH', 'IN_APP'], { each: true })
  channels?: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP')[];

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}
