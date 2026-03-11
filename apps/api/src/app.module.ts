import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

// Common modules
import { EncryptionModule } from './common/encryption/encryption.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { QueueModule } from './common/queue/queue.module';
import { EmailModule } from './common/email/email.module';
import { StorageModule } from './common/storage/storage.module';
import { EventsModule } from './common/events/events.module';
import { TelemetryModule, RequestIdMiddleware } from './common/telemetry';
import { FxModule } from './common/fx/fx.module';
import { LoggerModule } from './common/logger/logger.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ListingsModule } from './modules/listings/listings.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SearchModule } from './modules/search/search.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { GeoModule } from './modules/geo/geo.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { FraudDetectionModule } from './modules/fraud-detection/fraud-detection.module';
import { AiModule } from './modules/ai/ai.module';
import { PolicyEngineModule } from './modules/policy-engine/policy-engine.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { CleanupModule } from './common/cleanup/cleanup.module';

import configuration from './config/configuration';
import { CsrfGuard } from './common/guards/csrf.guard';
import { ConfigCascadeModule } from './common/config/config-cascade.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env.local', '.env'],
    }),

    // Config cascade: env → org → user preferences
    ConfigCascadeModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Bull Queue
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
      }),
    }),

    // Elasticsearch removed - now using PostgreSQL search

    // Common modules
    LoggerModule,
    EncryptionModule,
    PrismaModule,
    CacheModule,
    QueueModule,
    EmailModule,
    StorageModule,
    EventsModule,
    TelemetryModule,
    FxModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    ListingsModule,
    BookingsModule,
    PaymentsModule,
    SearchModule, // Re-enabled with PostgreSQL search
    MessagingModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    FavoritesModule,
    AnalyticsModule,
    AdminModule,
    ModerationModule,
    InsuranceModule,
    GeoModule,
    OrganizationsModule,
    FraudDetectionModule,
    AiModule,
    PolicyEngineModule,
    PricingModule,
    ComplianceModule,
    MarketplaceModule,
    MetricsModule,
    CleanupModule,
  ],
  providers: [
    // Global rate limiting guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global CSRF guard: JWT Bearer routes are auto-exempt; webhooks use @SkipCsrf()
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
