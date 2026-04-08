import { Injectable } from '@nestjs/common';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class VersionCompatibilityValidator {
  async validateResponse(version: string, path: string, data: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!version) {
      errors.push('API version is required');
    }

    if (!['1.0', '2.0'].includes(version)) {
      errors.push(`Unsupported API version: ${version}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async validateRequest(version: string, path: string, data: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!version) {
      errors.push('API version is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async checkCompatibility(clientVersion: string, serverVersion: string): Promise<{
    compatible: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    if (clientVersion !== serverVersion) {
      warnings.push(`Version mismatch: client ${clientVersion}, server ${serverVersion}`);
    }

    return {
      compatible: true,
      warnings
    };
  }

  async detectBreakingChanges(fromVersion: string, toVersion: string): Promise<any[]> {
    const changes: any[] = [];

    if (fromVersion === '1.0' && toVersion === '2.0') {
      changes.push({
        type: 'breaking',
        description: 'User schema changed',
        field: 'username',
        action: 'removed'
      });
    }

    return changes;
  }

  async validateCompatibility(clientVersion: string, serverVersion: string): Promise<{
    isValid: boolean;
    isCompatible: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (clientVersion !== serverVersion) {
      warnings.push(`Version mismatch: client ${clientVersion}, server ${serverVersion}`);
    }

    return {
      isValid: errors.length === 0,
      isCompatible: true,
      errors,
      warnings
    };
  }
}
