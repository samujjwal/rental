import { ApiProperty } from '@nestjs/swagger';

export class GeoAddressComponentsDto {
  @ApiProperty({ example: 'Baneshwor', required: false })
  subLocality?: string;

  @ApiProperty({ example: 'Kathmandu', required: false })
  locality?: string;

  @ApiProperty({ example: 'Bagmati Province', required: false })
  adminAreaLevel1?: string;

  @ApiProperty({ example: 'Kathmandu District', required: false })
  adminAreaLevel2?: string;

  @ApiProperty({ example: '44600', required: false })
  postalCode?: string;

  @ApiProperty({ example: 'NP', required: false })
  countryCode?: string;

  @ApiProperty({ example: 'Nepal', required: false })
  country?: string;
}

export class GeoCoordinatesDto {
  @ApiProperty({ example: 27.7172 })
  lat: number;

  @ApiProperty({ example: 85.324 })
  lon: number;
}

export class GeoSuggestionDto {
  @ApiProperty({ example: 'nominatim:1234567' })
  id: string;

  @ApiProperty({ example: 'nominatim' })
  provider: string;

  @ApiProperty({ example: 'nominatim:1234567', required: false })
  placeId?: string;

  @ApiProperty({ example: 'Baneshwor, Kathmandu' })
  shortLabel: string;

  @ApiProperty({
    example: 'Baneshwor, Kathmandu Metropolitan City, Kathmandu, Bagmati, Nepal',
  })
  formattedAddress: string;

  @ApiProperty({ type: GeoCoordinatesDto })
  coordinates: GeoCoordinatesDto;

  @ApiProperty({ type: GeoAddressComponentsDto })
  address: GeoAddressComponentsDto;

  @ApiProperty({ type: [String], example: ['suburb', 'city'] })
  types: string[];

  @ApiProperty({ example: 0.92, required: false })
  confidence?: number;

  @ApiProperty({ example: 25, required: false })
  accuracyMeters?: number;
}

export class GeoAutocompleteResponseDto {
  @ApiProperty({ type: [GeoSuggestionDto] })
  results: GeoSuggestionDto[];
}

export class GeoReverseResponseDto {
  @ApiProperty({ type: GeoSuggestionDto, nullable: true })
  result: GeoSuggestionDto | null;
}
