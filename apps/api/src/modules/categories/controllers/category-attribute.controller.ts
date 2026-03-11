import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import {
  CategoryAttributeService,
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
  SetAttributeValueDto,
  BulkSetAttributeValuesDto,
} from '../services/category-attribute.service';

@ApiTags('Category Attributes')
@Controller('categories')
export class CategoryAttributeController {
  constructor(
    private readonly attributeService: CategoryAttributeService,
  ) {}

  // ──────── Definition Endpoints ────────

  @Post(':categoryId/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new attribute definition for a category' })
  @ApiResponse({ status: 201, description: 'Attribute definition created' })
  async createDefinition(
    @Param('categoryId') categoryId: string,
    @Body() body: Omit<CreateAttributeDefinitionDto, 'categoryId'>,
  ) {
    return this.attributeService.createDefinition({
      ...body,
      categoryId,
    });
  }

  @Get(':categoryId/attributes')
  @ApiOperation({ summary: 'Get all attribute definitions for a category' })
  @ApiResponse({ status: 200, description: 'List of attribute definitions' })
  async getDefinitions(@Param('categoryId') categoryId: string) {
    return this.attributeService.findDefinitionsByCategory(categoryId);
  }

  @Get('attributes/:id')
  @ApiOperation({ summary: 'Get a single attribute definition' })
  @ApiResponse({ status: 200, description: 'Attribute definition' })
  async getDefinition(@Param('id') id: string) {
    return this.attributeService.findDefinitionById(id);
  }

  @Patch('attributes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an attribute definition' })
  @ApiResponse({ status: 200, description: 'Attribute definition updated' })
  async updateDefinition(
    @Param('id') id: string,
    @Body() body: UpdateAttributeDefinitionDto,
  ) {
    return this.attributeService.updateDefinition(id, body);
  }

  @Delete('attributes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attribute definition' })
  @ApiResponse({ status: 204, description: 'Attribute definition deleted' })
  async deleteDefinition(@Param('id') id: string) {
    await this.attributeService.deleteDefinition(id);
  }

  // ──────── Value Endpoints ────────

  @Post('listings/:listingId/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a single attribute value for a listing' })
  @ApiResponse({ status: 200, description: 'Attribute value set' })
  async setValue(
    @Param('listingId') listingId: string,
    @Body() body: Omit<SetAttributeValueDto, 'listingId'>,
  ) {
    return this.attributeService.setValue({ ...body, listingId });
  }

  @Post('listings/:listingId/attributes/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk set attribute values for a listing' })
  @ApiResponse({ status: 200, description: 'Attribute values set' })
  async bulkSetValues(
    @Param('listingId') listingId: string,
    @Body() body: Omit<BulkSetAttributeValuesDto, 'listingId'>,
  ) {
    return this.attributeService.bulkSetValues({ ...body, listingId });
  }

  @Get('listings/:listingId/attributes')
  @ApiOperation({ summary: 'Get all attribute values for a listing' })
  @ApiResponse({ status: 200, description: 'List of attribute values' })
  async getValues(@Param('listingId') listingId: string) {
    return this.attributeService.getValuesForListing(listingId);
  }

  @Delete('listings/:listingId/attributes/:attributeDefinitionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific attribute value' })
  @ApiResponse({ status: 204, description: 'Attribute value deleted' })
  async deleteValue(
    @Param('listingId') listingId: string,
    @Param('attributeDefinitionId') attributeDefinitionId: string,
  ) {
    await this.attributeService.deleteValue(listingId, attributeDefinitionId);
  }

  @Get('listings/:listingId/attributes/validate')
  @ApiOperation({ summary: 'Validate all required attributes are set for a listing' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateAttributes(
    @Param('listingId') listingId: string,
    @Body() body: { categoryId: string },
  ) {
    return this.attributeService.validateRequiredAttributes(
      listingId,
      body.categoryId,
    );
  }
}
