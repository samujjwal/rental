import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { FilterBuilderService } from './services/filter-builder.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminService, FilterBuilderService],
  exports: [AdminService],
})
export class AdminModule {}
