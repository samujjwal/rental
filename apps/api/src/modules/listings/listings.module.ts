import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ListingsService } from './services/listings.service';
import { PropertyValidationService } from './services/listing-validation.service';
import { AvailabilityService } from './services/availability.service';
import { AvailabilitySlotService } from './services/availability-slot.service';
import { ListingCompletenessService } from './services/listing-completeness.service';
import { ListingContentService } from './services/listing-content.service';
import { ListingVersionService } from './services/listing-version.service';
import { InventoryUnitService } from './services/inventory-unit.service';
import { ListingAuthMonitorService } from './services/listing-auth-monitor.service';
import { ListingsController } from './controllers/listings.controller';
import { ListingContentController } from './controllers/listing-content.controller';
import { ListingVersionController } from './controllers/listing-version.controller';
import { CategoriesModule } from '../categories/categories.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AiModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [
    CategoriesModule,
    ModerationModule,
    AiModule,
    SearchModule,
    CurrencyModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessTokenExpiry'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ListingsController, ListingContentController, ListingVersionController],
  providers: [
    ListingsService,
    PropertyValidationService,
    AvailabilityService,
    AvailabilitySlotService,
    ListingCompletenessService,
    ListingContentService,
    ListingVersionService,
    InventoryUnitService,
    ListingAuthMonitorService,
  ],
  exports: [
    ListingsService,
    AvailabilityService,
    AvailabilitySlotService,
    ListingContentService,
    ListingVersionService,
    InventoryUnitService,
  ],
})
export class ListingsModule {}
