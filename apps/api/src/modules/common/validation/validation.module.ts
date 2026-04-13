/**
 * Validation Module
 * 
 * Provides API contract validation and DTO validation
 */

import { Module, Global } from '@nestjs/common';
import { ApiContractValidator } from './services/api-contract-validator.service';
import { ApiSchemaValidator } from './services/api-schema-validator.service';
import { ApiVersioningService } from './services/api-versioning.service';

@Global()
@Module({
  providers: [ApiContractValidator, ApiSchemaValidator, ApiVersioningService],
  exports: [ApiContractValidator, ApiSchemaValidator, ApiVersioningService],
})
export class ValidationModule {}

export { ApiContractValidator, ApiSchemaValidator, ApiVersioningService };
