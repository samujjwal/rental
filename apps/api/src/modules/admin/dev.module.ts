import { Module } from '@nestjs/common';
import { DevController } from './controllers/dev.controller';
import { PrismaService } from '@/common/prisma/prisma.service';

@Module({
  controllers: [DevController],
  providers: [PrismaService],
})
export class DevModule {}
