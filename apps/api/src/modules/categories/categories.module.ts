import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service';
import { CategoryTemplateService } from './services/category-template.service';
import { CategoriesController } from './controllers/categories.controller';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryTemplateService],
  exports: [CategoriesService, CategoryTemplateService],
})
export class CategoriesModule {}
