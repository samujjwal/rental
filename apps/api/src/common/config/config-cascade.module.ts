import { Global, Module } from '@nestjs/common';
import { ConfigCascadeService } from './config-cascade.service';
import { ExternalServiceConfigService } from './external-service-config.service';

/**
 * Global module that provides ConfigCascadeService for resolving
 * locale/currency/timezone with env → org → user preference cascade.
 */
@Global()
@Module({
  providers: [ConfigCascadeService, ExternalServiceConfigService],
  exports: [ConfigCascadeService, ExternalServiceConfigService],
})
export class ConfigCascadeModule {}
