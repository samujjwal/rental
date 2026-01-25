import { Module } from '@nestjs/common';
import { EmailModule } from '@/common/email/email.module';
import { FulfillmentService } from './services/fulfillment.service';
import { FulfillmentController } from './controllers/fulfillment.controller';

@Module({
  imports: [EmailModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
