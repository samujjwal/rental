import { Module, forwardRef } from '@nestjs/common';
import { ListingsService } from './services/listings.service';
import { PropertyValidationService } from './services/listing-validation.service';
import { AvailabilityService } from './services/availability.service';
import { ListingCompletenessService } from './services/listing-completeness.service';
import { ListingsController } from './controllers/listings.controller';
import { CategoriesModule } from '../categories/categories.module';
import { SearchModule } from '../search/search.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [CategoriesModule, forwardRef(() => SearchModule), ModerationModule, AiModule],
  controllers: [ListingsController],
  providers: [ListingsService, PropertyValidationService, AvailabilityService, ListingCompletenessService],
  exports: [ListingsService, AvailabilityService],
})
export class ListingsModule {}
