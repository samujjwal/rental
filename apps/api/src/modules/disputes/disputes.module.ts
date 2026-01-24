import { Module } from '@nestjs/common';
import { DisputesService } from './services/disputes.service';
import { DisputesController } from './controllers/disputes.controller';

@Module({
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
