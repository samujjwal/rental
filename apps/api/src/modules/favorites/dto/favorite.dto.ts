import { IsString, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddFavoriteDto {
  @ApiProperty({ description: 'Listing ID to add to favorites' })
  @IsUUID()
  listingId: string;
}

export class BulkFavoriteDto {
  @ApiProperty({ description: 'Array of listing IDs' })
  @IsArray()
  @IsUUID('all', { each: true })
  listingIds: string[];
}
