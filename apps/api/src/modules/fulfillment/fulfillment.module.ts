import { Module } from '@nestjs/common';
import { FulfillmentService } from './services/fulfillment.service';
import { FulfillmentController } from './controllers/fulfillment.controller';

@Module({
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
