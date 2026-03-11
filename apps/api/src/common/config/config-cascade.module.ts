import { Global, Module } from '@nestjs/common';
import { ConfigCascadeService } from './config-cascade.service';

/**
 * Global module that provides ConfigCascadeService for resolving
 * locale/currency/timezone with env → org → user preference cascade.
 */
@Global()
@Module({
  providers: [ConfigCascadeService],
  exports: [ConfigCascadeService],
})
export class ConfigCascadeModule {}
