import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

// Common modules
import { PrismaModule } from './common/prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { QueueModule } from './common/queue/queue.module';
import { EmailModule } from './common/email/email.module';
import { StorageModule } from './common/storage/storage.module';
import { ModerationModule as CommonModerationModule } from './common/moderation/moderation.module';

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
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { InsuranceModule } from './modules/insurance/insurance.module';

import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

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

    // Elasticsearch
    ElasticsearchModule.registerAsync({
      useFactory: () => ({
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: process.env.ELASTICSEARCH_USERNAME
          ? {
              username: process.env.ELASTICSEARCH_USERNAME,
              password: process.env.ELASTICSEARCH_PASSWORD || '',
            }
          : undefined,
      }),
    }),

    // Common modules
    PrismaModule,
    CacheModule,
    QueueModule,
    EmailModule,
    StorageModule,
    CommonModerationModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    ListingsModule,
    BookingsModule,
    PaymentsModule,
    SearchModule,
    MessagingModule,
    ReviewsModule,
    FulfillmentModule,
    DisputesModule,
    NotificationsModule,
    AdminModule,
    ModerationModule,
    InsuranceModule,
  ],
})
export class AppModule {}
