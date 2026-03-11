import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { DemandForecastingService } from '../services/demand-forecasting.service';
import { RecordSignalDto, ForecastQueryDto, BacktestQueryDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Demand Forecasting')
@Controller('marketplace/demand')
export class DemandForecastController {
  constructor(private readonly forecasting: DemandForecastingService) {}

  @Post('signals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a demand signal' })
  @ApiResponse({ status: 201, description: 'Signal recorded' })
  async recordSignal(@Body() dto: RecordSignalDto) {
    return this.forecasting.recordSignal({
      ...dto,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }

  @Get('forecast')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate demand forecast for a country' })
  @ApiResponse({ status: 200, description: 'Forecast generated' })
  async generateForecast(@Query() query: ForecastQueryDto) {
    return this.forecasting.generateForecast(query.country, query.horizon, query.region, query.category);
  }

  @Get('forecasts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stored forecasts for a country' })
  @ApiResponse({ status: 200, description: 'Forecasts retrieved' })
  async getForecasts(@Query('country') country: string, @Query('horizon') horizon?: string) {
    return this.forecasting.getForecasts(country, horizon);
  }

  @Get('backtest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Backtest forecast accuracy' })
  @ApiResponse({ status: 200, description: 'Backtest results' })
  async backtestAccuracy(@Query() query: BacktestQueryDto) {
    return this.forecasting.backtestAccuracy(query.country, query.days);
  }
}
