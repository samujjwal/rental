/**
 * Security Module
 * 
 * Provides security services including SQL injection prevention and XSS protection
 */

import { Module, Global } from '@nestjs/common';
import { SqlInjectionGuardService } from './sql-injection-guard.service';
import { XssProtectionService } from './xss-protection.service';

@Global()
@Module({
  providers: [SqlInjectionGuardService, XssProtectionService],
  exports: [SqlInjectionGuardService, XssProtectionService],
})
export class SecurityModule {}

export { SqlInjectionGuardService, XssProtectionService };
