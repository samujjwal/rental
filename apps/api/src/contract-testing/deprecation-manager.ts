import { Injectable } from '@nestjs/common';

@Injectable()
export class DeprecationManager {
  private deprecatedEndpoints: Record<string, any> = {
    '/api/v1/legacy-users': {
      deprecatedSince: '2023-01-01',
      removalDate: '2024-01-01',
      replacement: '/api/v2/users',
      warning: 'This endpoint is deprecated. Use /api/v2/users instead.'
    }
  };

  async isDeprecated(path: string): Promise<boolean> {
    return path in this.deprecatedEndpoints;
  }

  async getDeprecationInfo(path: string): Promise<any> {
    return this.deprecatedEndpoints[path] || null;
  }

  async getAllDeprecatedEndpoints(): Promise<Record<string, any>> {
    return this.deprecatedEndpoints;
  }

  async getDeprecationHeaders(path: string): Promise<Record<string, string>> {
    const info = this.deprecatedEndpoints[path];

    if (!info) {
      return {};
    }

    return {
      'Deprecation': `true`,
      'Sunset': info.removalDate,
      'Link': `<${info.replacement}>; rel="successor-version"`
    };
  }

  async getUsageMetrics(): Promise<any> {
    return {
      totalRequests: 1000,
      deprecatedEndpointUsage: 50,
      migrationProgress: 95
    };
  }
}
