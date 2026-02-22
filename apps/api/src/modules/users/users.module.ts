import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { DataExportService } from './services/data-export.service';
import { KycService } from './services/kyc.service';
import { UsersController } from './controllers/users.controller';
import { KycController } from './controllers/kyc.controller';

@Module({
  controllers: [UsersController, KycController],
  providers: [UsersService, DataExportService, KycService],
  exports: [UsersService, KycService],
})
export class UsersModule {}
