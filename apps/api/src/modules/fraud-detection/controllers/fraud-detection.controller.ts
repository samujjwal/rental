import { Controller, Get, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@rental-portal/database';

@ApiTags('Fraud')
@Controller('fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FraudDetectionController {
  constructor(private readonly fraudService: FraudDetectionService) {}

  @Get('high-risk-users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get users with high risk scores' })
  @ApiResponse({ status: 200, description: 'List of high risk users' })
  async getHighRiskUsers(@Query('limit', ParseIntPipe) limit = 20) {
    return this.fraudService.getHighRiskUsers(limit);
  }
}
