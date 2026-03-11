import { Module } from '@nestjs/common';
import { ReviewsService } from './services/reviews.service';
import { ReviewsController } from './controllers/reviews.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { ModerationModule } from '../moderation/moderation.module';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [BookingsModule, ModerationModule, EventsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
