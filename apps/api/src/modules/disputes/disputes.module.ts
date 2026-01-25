import { Module } from '@nestjs/common';
import { EmailModule } from '@/common/email/email.module';
import { DisputesService } from './services/disputes.service';
import { DisputesController } from './controllers/disputes.controller';

@Module({
  imports: [EmailModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
