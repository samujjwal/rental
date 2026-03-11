import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminSystemService } from './services/admin-system.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminEntityService } from './services/admin-entity.service';
import { FilterBuilderService } from './services/filter-builder.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminAnalyticsService,
    AdminUsersService,
    AdminSystemService,
    AdminContentService,
    AdminEntityService,
    FilterBuilderService,
  ],
  exports: [
    AdminService,
    AdminAnalyticsService,
    AdminUsersService,
    AdminSystemService,
    AdminContentService,
    AdminEntityService,
  ],
})
export class AdminModule {}
