import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  CategoriesService,
} from '../services/categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import { CategoryTemplateService } from '../services/category-template.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@rental-portal/database';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;
type CategoryEntity = AsyncMethodResult<CategoriesService['findById']>;

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly templateService: CategoryTemplateService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async findAll(
    @Query('activeOnly') activeOnly?: string,
  ): Promise<AsyncMethodResult<CategoriesService['findAll']>> {
    const active = activeOnly === 'false' ? false : true;
    return this.categoriesService.findAll(active);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all category templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getAllTemplates() {
    return this.templateService.getAllCategoryTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findById(
    @Param('id') id: string,
  ): Promise<AsyncMethodResult<CategoriesService['findById']>> {
    return this.categoriesService.findById(id);
  }

  @Get(':id/template')
  @ApiOperation({ summary: 'Get category template schema' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getCategoryTemplate(@Param('id') id: string): Promise<{
    category: CategoryEntity;
    templateSchema: CategoryEntity['templateSchema'];
  }> {
    const category = await this.categoriesService.findById(id);
    return {
      category,
      templateSchema: category.templateSchema,
    };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get category statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getCategoryStats(
    @Param('id') id: string,
  ): Promise<AsyncMethodResult<CategoriesService['getCategoryStats']>> {
    return this.categoriesService.getCategoryStats(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<AsyncMethodResult<CategoriesService['findBySlug']>> {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (Admin only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or slug already exists' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(
    @Body() dto: CreateCategoryDto,
  ): Promise<AsyncMethodResult<CategoriesService['create']>> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category (Admin only)' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<AsyncMethodResult<CategoriesService['update']>> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category (Admin only)' })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 400, description: 'Category has associated listings' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async delete(@Param('id') id: string) {
    await this.categoriesService.delete(id);
  }
}
