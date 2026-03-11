import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { KycService, UploadDocumentDto, ReviewDocumentDto } from '../services/kyc.service';
import { JwtAuthGuard, RolesGuard, Permission, Permissions, CurrentUser, Roles } from '@/common/auth';
import { UserRole, IdentityDocumentType } from '@rental-portal/database';

class UploadDocumentRequestDto {
  @IsEnum(IdentityDocumentType)
  documentType: IdentityDocumentType;

  @IsString()
  documentUrl: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class ReviewDocumentRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

@ApiTags('Identity Verification')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('documents')
  @ApiOperation({ summary: 'Upload an identity document for verification' })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadDocumentRequestDto,
  ) {
    return this.kycService.uploadDocument(userId, dto);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get my identity documents' })
  async getMyDocuments(@CurrentUser('id') userId: string) {
    return this.kycService.getUserDocuments(userId);
  }

  @Get('documents/history')
  @ApiOperation({ summary: 'Get KYC document status history for current user' })
  async getDocumentHistory(@CurrentUser('id') userId: string) {
    return this.kycService.getDocumentHistory(userId);
  }

  @Get('documents/pending')
  @UseGuards(RolesGuard)
  @Permissions(Permission.REVIEW_KYC)
  @ApiOperation({ summary: 'Admin: Get pending documents for review' })
  async getPendingDocuments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kycService.getPendingDocuments(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('documents/:id/review')
  @UseGuards(RolesGuard)
  @Permissions(Permission.REVIEW_KYC)
  @ApiOperation({ summary: 'Admin: Review an identity document' })
  async reviewDocument(
    @Param('id') documentId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewDocumentRequestDto,
  ) {
    return this.kycService.reviewDocument(documentId, adminId, dto);
  }
}
