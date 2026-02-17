import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { AiService, GenerateDescriptionDto } from './services/ai.service';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-description')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a listing description using AI' })
  async generateDescription(@Body() dto: GenerateDescriptionDto) {
    return this.aiService.generateListingDescription(dto);
  }
}
