import { Module } from '@nestjs/common';
import { DistributedLockService } from './distributed-lock.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [DistributedLockService],
  exports: [DistributedLockService],
})
export class LockingModule {}
