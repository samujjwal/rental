import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsString()
  @MinLength(1)
  conversationId: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiProperty({ description: 'Attachment URLs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class CreateConversationDto {
  @ApiProperty({ description: 'Listing ID for the conversation' })
  @IsString()
  @MinLength(1)
  listingId: string;

  @ApiProperty({ description: 'Other participant ID' })
  @IsString()
  @MinLength(1)
  participantId: string;
}
