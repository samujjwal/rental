import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3StorageService } from './s3.service';
import { StorageController } from './storage.controller';
import { UploadController } from './upload.controller';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [ConfigModule, AuthorizationModule],
  controllers: [StorageController, UploadController],
  providers: [StorageService, S3StorageService],
  exports: [StorageService, S3StorageService],
})
export class StorageModule {}
