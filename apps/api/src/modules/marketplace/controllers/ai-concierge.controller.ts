import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { AiConciergeService } from '../services/ai-concierge.service';
import { StartSessionDto, ProcessMessageDto, EndSessionDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - AI Concierge')
@Controller('marketplace/concierge')
export class AiConciergeController {
  constructor(private readonly concierge: AiConciergeService) {}

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new AI concierge session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  async startSession(@CurrentUser('id') userId: string, @Body() dto: StartSessionDto) {
    return this.concierge.startSession(userId, dto.agentType, dto.initialContext);
  }

  @Post('sessions/:sessionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message to the AI concierge' })
  @ApiResponse({ status: 200, description: 'AI response generated' })
  async processMessage(@Param('sessionId') sessionId: string, @Body() dto: ProcessMessageDto) {
    return this.concierge.processMessage(sessionId, dto.message);
  }

  @Patch('sessions/:sessionId/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End a concierge session' })
  @ApiResponse({ status: 200, description: 'Session ended' })
  async endSession(@Param('sessionId') sessionId: string, @Body() dto: EndSessionDto) {
    return this.concierge.endSession(sessionId, dto.satisfaction);
  }

  @Get('sessions/:sessionId/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get conversation history' })
  @ApiResponse({ status: 200, description: 'History retrieved' })
  async getHistory(@Param('sessionId') sessionId: string) {
    return this.concierge.getConversationHistory(sessionId);
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized listing recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations generated' })
  async getRecommendations(@CurrentUser('id') userId: string, @Query('limit') limit?: number) {
    return this.concierge.getRecommendations(userId, limit ?? 10);
  }
}
