import { ApiProperty } from '@nestjs/swagger';

export class SearchLocationDto {
  @ApiProperty({ example: 37.7793 })
  lat?: number;

  @ApiProperty({ example: -122.4193 })
  lon?: number;
}

export class SearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categorySlug: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  country: string;

  @ApiProperty({ type: SearchLocationDto, required: false })
  location?: SearchLocationDto;

  @ApiProperty()
  basePrice: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty()
  ownerName: string;

  @ApiProperty()
  ownerRating: number;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  totalReviews: number;

  @ApiProperty({ required: false })
  bookingMode?: string;

  @ApiProperty({ required: false })
  condition?: string;

  @ApiProperty({ type: [String], required: false })
  features?: string[];

  @ApiProperty({ required: false })
  score?: number;
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultDto] })
  results: SearchResultDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  size: number;

  @ApiProperty({ required: false })
  aggregations?: unknown;
}
