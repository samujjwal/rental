import { IsString, IsOptional, IsNumber, IsDateString, IsObject, Min, Max, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { AgentType } from '@rental-portal/database';

// ─── Liquidity Engine DTOs ───────────────────────────────────────────────────

export class HealthMetricsQueryDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
}

export class HealthHistoryQueryDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsNumber() days?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
}

export class SupplyGapQueryDto {
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsNumber() threshold?: number;
}

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @IsString() targetSegment: string;
  @ApiProperty() @IsString() strategy: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @Type(() => Number) @IsNumber() budget: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsOptional() @IsString() currency?: string;
}

// ─── AI Concierge DTOs ──────────────────────────────────────────────────────

export class StartSessionDto {
  @ApiPropertyOptional({ default: 'GENERAL', enum: AgentType }) @IsOptional() @IsEnum(AgentType) agentType?: AgentType;
  @ApiPropertyOptional() @IsOptional() @IsObject() initialContext?: Record<string, any>;
}

export class ProcessMessageDto {
  @ApiProperty() @IsString() message: string;
}

export class EndSessionDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) satisfaction?: number;
}

// ─── Demand Forecasting DTOs ────────────────────────────────────────────────

export class RecordSignalDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiProperty() @IsString() signalType: string;
  @ApiProperty() @Type(() => Number) @IsNumber() signalValue: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, any>;
}

export class ForecastQueryDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional({ default: '30d' }) @IsOptional() @IsString() horizon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
}

export class BacktestQueryDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsNumber() days?: number;
}

// ─── Expansion Planner DTOs ─────────────────────────────────────────────────

export class EvaluateMarketDto {
  @ApiProperty() @IsString() country: string;
}

// ─── Multi-Modal Search DTOs ────────────────────────────────────────────────

export class LocationDto {
  @ApiProperty() @Type(() => Number) @IsNumber() latitude: number;
  @ApiProperty() @Type(() => Number) @IsNumber() longitude: number;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsNumber() radiusKm?: number;
}

export class SearchFiltersDto {
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() guestCount?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() amenities?: string[];
}

export class MarketplaceSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() query?: string;
  @ApiPropertyOptional({ default: 'TEXT' }) @IsOptional() @IsString() searchType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionId?: string;
  @ApiPropertyOptional({ type: SearchFiltersDto }) @IsOptional() @IsObject() filters?: SearchFiltersDto;
  @ApiPropertyOptional({ type: LocationDto }) @IsOptional() @IsObject() location?: LocationDto;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}

export class RecordClickDto {
  @ApiProperty() @IsString() searchEventId: string;
  @ApiProperty() @IsString() listingId: string;
}

export class SearchAnalyticsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsNumber() days?: number;
}

// ─── Pricing Intelligence DTOs ──────────────────────────────────────────────

export class PricingRecommendationQueryDto {
  @ApiProperty() @IsString() listingId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetDate?: string;
}

export class AutoAcceptDto {
  @ApiProperty() @IsString() listingId: string;
  @ApiPropertyOptional({ default: 10 }) @IsOptional() @Type(() => Number) @IsNumber() @Max(50) maxDeviationPercent?: number;
}

// ─── Fraud Intelligence DTOs ────────────────────────────────────────────────

export class AnalyzeRiskDto {
  @ApiProperty() @IsString() entityType: string;
  @ApiProperty() @IsString() entityId: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() context?: {
    userId?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    amount?: number;
    country?: string;
  };
}

export class MarketplaceRegisterDeviceDto {
  @ApiProperty() @IsString() fingerprint: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: {
    userAgent?: string;
    platform?: string;
    screenRes?: string;
    timezone?: string;
    language?: string;
    ipAddress?: string;
  };
}

export class ResolveSignalDto {
  @ApiProperty() @IsString() resolvedBy: string;
}

// ─── Inventory Graph DTOs ───────────────────────────────────────────────────

export class AddNodeDto {
  @ApiProperty() @IsString() nodeType: string;
  @ApiProperty() @IsString() entityId: string;
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() properties?: Record<string, any>;
}

export class AddEdgeDto {
  @ApiProperty() @IsString() fromNodeId: string;
  @ApiProperty() @IsString() toNodeId: string;
  @ApiProperty() @IsString() edgeType: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() properties?: Record<string, any>;
}

// ─── Availability Graph DTOs ────────────────────────────────────────────────

export class AvailabilityCheckDto {
  @ApiProperty() @IsString() listingId: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
}

export class BulkAvailabilityCheckDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) listingIds: string[];
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
}

export class ReserveSlotDto {
  @ApiProperty() @IsString() listingId: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @Type(() => Number) @IsNumber() totalPrice: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsOptional() @IsString() currency?: string;
}

export class CalendarHeatmapQueryDto {
  @ApiProperty() @IsString() listingId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() year: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(1) @Max(12) month: number;
}

// ─── Payment Orchestration DTOs ─────────────────────────────────────────────

export class AuthorizePaymentDto {
  @ApiProperty() @Type(() => Number) @IsNumber() amount: number;
  @ApiProperty() @IsString() currency: string;
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, any>;
}

export class CapturePaymentDto {
  @ApiProperty() @IsString() transactionId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() amount: number;
  @ApiProperty() @IsString() providerName: string;
}

export class RefundPaymentDto {
  @ApiProperty() @IsString() transactionId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() amount: number;
  @ApiProperty() @IsString() providerName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class PayoutDto {
  @ApiProperty() @IsString() recipientId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() amount: number;
  @ApiProperty() @IsString() currency: string;
  @ApiProperty() @IsString() country: string;
}

// ─── Tax Policy Engine DTOs ─────────────────────────────────────────────────

export class UpsertTaxPolicyDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiProperty() @IsString() taxType: string;
  @ApiProperty() @Type(() => Number) @IsNumber() rate: number;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() rules?: Record<string, any>;
}

export class MarketplaceCalculateTaxDto {
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() amount: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
}

export class UpdatePolicyVersionDto {
  @ApiProperty() @Type(() => Number) @IsNumber() newRate: number;
  @ApiProperty() @IsDateString() effectiveFrom: string;
}

// ─── Country Policy Pack DTOs ───────────────────────────────────────────────

export class UpsertPolicyPackDto {
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @IsString() currency: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) languages: string[];
  @ApiProperty() @IsString() timezone: string;
  @ApiProperty() @IsObject() policies: Record<string, any>;
}

export class ValidateBookingDto {
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @Type(() => Number) @IsNumber() durationDays: number;
  @ApiProperty() @Type(() => Number) @IsNumber() durationHours: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() hostAge?: number;
}

// ─── Reputation DTOs ────────────────────────────────────────────────────────

export class CreateModerationActionDto {
  @ApiProperty() @IsString() targetType: string;
  @ApiProperty() @IsString() targetId: string;
  @ApiProperty() @IsString() action: string;
  @ApiProperty() @IsString() reason: string;
}

export class ResolveModerationDto {
  @ApiProperty() @IsString() resolution: string;
}

// ─── Dispute Resolution DTOs ────────────────────────────────────────────────

export class FileDisputeDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty() @IsString() respondentId: string;
  @ApiProperty() @IsString() category: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() evidence?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() amount?: number;
}

export class SubmitEvidenceDto {
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() urls?: string[];
}

export class ResolveDisputeDto {
  @ApiProperty() @IsString() resolution: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() compensationAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ─── Observability DTOs ─────────────────────────────────────────────────────

export class RecordHealthCheckDto {
  @ApiProperty() @IsString() serviceName: string;
  @ApiProperty() @IsString() status: string;
  @ApiProperty() @Type(() => Number) @IsNumber() responseTimeMs: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() details?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() endpoint?: string;
}

export class DetectAnomalyDto {
  @ApiProperty() @IsString() metric: string;
  @ApiProperty() @Type(() => Number) @IsNumber() value: number;
  @ApiProperty() @Type(() => Number) @IsNumber() threshold: number;
  @ApiProperty() @IsString() serviceName: string;
}

// ─── Geo Distribution DTOs ──────────────────────────────────────────────────

export class UpsertRegionDto {
  @ApiProperty() @IsString() regionCode: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsObject() config: Record<string, any>;
}

export class SimulateFailoverDto {
  @ApiProperty() @IsString() fromRegion: string;
  @ApiProperty() @IsString() toRegion: string;
}

// ─── Compliance Automation DTOs ─────────────────────────────────────────────

export class GenerateAuditTrailDto {
  @ApiProperty() @IsString() entityType: string;
  @ApiProperty() @IsString() entityId: string;
  @ApiProperty() @IsString() action: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() details?: Record<string, any>;
}

export class RegulatoryReportQueryDto {
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
}

export class CheckoutDto {
  @ApiProperty({ description: 'Listing ID to book' }) @IsString() listingId: string;
  @ApiProperty({ description: 'Check-in date (ISO 8601)' }) @IsDateString() startDate: string;
  @ApiProperty({ description: 'Check-out date (ISO 8601)' }) @IsDateString() endDate: string;
  @ApiProperty({ description: 'Number of guests' }) @IsNumber() guestCount: number;
  @ApiProperty({ description: 'Payment method identifier' }) @IsString() paymentMethod: string;
  @ApiProperty({ description: 'Country code (e.g., NP, IN)' }) @IsString() country: string;
  @ApiProperty({ description: 'Currency code (e.g., NPR, INR)' }) @IsString() currency: string;
  @ApiPropertyOptional({ description: 'Additional booking metadata' }) @IsOptional() @IsObject() metadata?: Record<string, any>;
}

export class RefreshLockDto {
  @ApiProperty({ description: 'Lock key to refresh' }) @IsString() lockKey: string;
  @ApiPropertyOptional({ description: 'Additional TTL in seconds' }) @IsOptional() @IsNumber() additionalTtl?: number;
}
