import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service';
import { CategoryTemplateService } from './services/category-template.service';
import { CategoryAttributeService } from './services/category-attribute.service';
import { CategoriesController } from './controllers/categories.controller';
import { CategoryAttributeController } from './controllers/category-attribute.controller';

@Module({
  controllers: [CategoriesController, CategoryAttributeController],
  providers: [CategoriesService, CategoryTemplateService, CategoryAttributeService],
  exports: [CategoriesService, CategoryTemplateService, CategoryAttributeService],
})
export class CategoriesModule {}
