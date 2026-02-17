import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { GeoAutocompleteResponseDto, GeoReverseResponseDto } from './dto/geo.dto';

@ApiTags('Geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Location autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'lang', required: false, type: String })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lon', required: false, type: Number })
  @ApiQuery({ name: 'zoom', required: false, type: Number })
  @ApiQuery({ name: 'location_bias_scale', required: false, type: Number })
  @ApiQuery({ name: 'bbox', required: false, type: String })
  @ApiQuery({ name: 'layer', required: false, type: String })
  @ApiOkResponse({ type: GeoAutocompleteResponseDto, description: 'Location suggestions' })
  async autocomplete(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('lang') lang?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('zoom') zoom?: string,
    @Query('location_bias_scale') locationBiasScale?: string,
    @Query('bbox') bbox?: string,
    @Query('layer') layer?: string,
  ) {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }
    const parsedLimit = this.parseNumber(limit);
    const parsedLat = this.parseNumber(lat);
    const parsedLon = this.parseNumber(lon);
    const parsedZoom = this.parseNumber(zoom);
    const parsedLocationBiasScale = this.parseNumber(locationBiasScale);
    const results = await this.geoService.autocomplete(query, parsedLimit, lang, {
      lat: parsedLat,
      lon: parsedLon,
      zoom: parsedZoom,
      locationBiasScale: parsedLocationBiasScale,
      bbox,
      layer,
    });
    return { results };
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to a location' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lon', required: true, type: Number })
  @ApiQuery({ name: 'lang', required: false, type: String })
  @ApiOkResponse({ type: GeoReverseResponseDto, description: 'Reverse geocode result' })
  async reverse(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('lang') lang?: string,
  ) {
    const parsedLat = this.parseNumber(lat);
    const parsedLon = this.parseNumber(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      return { result: null };
    }
    const result = await this.geoService.reverse(parsedLat, parsedLon, lang);
    return { result };
  }
}
