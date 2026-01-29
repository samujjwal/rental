import { Module } from '@nestjs/common';
import { ListingsService } from './services/listings.service';
import { PropertyValidationService } from './services/listing-validation.service';
import { AvailabilityService } from './services/availability.service';
import { ListingsController } from './controllers/listings.controller';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [CategoriesModule],
  controllers: [ListingsController],
  providers: [ListingsService, PropertyValidationService, AvailabilityService],
  exports: [ListingsService, AvailabilityService],
})
export class ListingsModule {}
