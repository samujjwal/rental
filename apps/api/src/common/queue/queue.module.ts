import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'bookings' },
      { name: 'payments' },
      { name: 'notifications' },
      { name: 'search-indexing' },
      { name: 'emails' },
      { name: 'cleanup' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
