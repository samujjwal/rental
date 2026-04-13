/**
 * Search Analytics DTOs
 * 
 * Data Transfer Objects for search analytics API
 */

import { IsString, IsOptional, IsDate, IsNumber, IsArray, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SearchFilters,
  SearchAnalyticsMetrics,
  SearchAnalyticsDashboard,
  SearchInsight,
  RealtimeSearchAnalytics,
} from '../interfaces/search-analytics.interface';

export class LogSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  filters?: SearchFilters;

  @IsNumber()
  resultsCount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clickedResults?: string[];

  @IsNumber()
  searchDuration: number;

  @IsString()
  sessionId: string;
}

export class GetDashboardDto {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsOptional()
  @IsString()
  period?: string = 'daily';
}

export class GetTrendsDto {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
}

export class GetTopQueriesDto {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;
}

export class SearchAnalyticsResponseDto {
  success: boolean;
  data?:
    | SearchAnalyticsMetrics
    | SearchAnalyticsDashboard
    | SearchInsight[]
    | RealtimeSearchAnalytics
    | any;
  error?: string;
}
