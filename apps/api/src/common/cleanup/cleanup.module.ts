import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CleanupProcessor } from './cleanup.processor';
import { EventsModule } from '@/common/events/events.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditArchivalService } from '@/common/audit/audit-archival.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EventsModule,
    BullModule.registerQueue({ name: 'cleanup' }),
  ],
  providers: [
    CleanupProcessor,
    AuditArchivalService,
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const region = configService.get('AWS_REGION', 'us-east-1');
        const accessKeyId = configService.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get('AWS_SECRET_ACCESS_KEY');
        return new S3Client({
          region,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CleanupProcessor],
})
export class CleanupModule {}
