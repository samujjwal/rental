import { Injectable } from '@nestjs/common';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class OpenApiValidator {
  private spec: any = {
    openapi: '3.0.0',
    info: {
      title: 'GharBatai Rental Portal API',
      version: '1.0.0'
    },
    paths: {},
    components: {
      schemas: {}
    }
  };

  async getConfig(): Promise<any> {
    return this.spec;
  }

  async validateResponse(path: string, method: string, status: number, body: any): Promise<ValidationResult> {
    // Simplified validation - in real implementation would validate against OpenAPI spec
    const errors: string[] = [];

    if (status >= 200 && status < 300) {
      // Success response validation
      if (!body) {
        errors.push('Response body is required for successful responses');
      }
    }

    if (status >= 400) {
      // Error response validation
      if (!body.error && !body.message) {
        errors.push('Error response should contain error or message field');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async validateRequest(path: string, method: string, body: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (method === 'POST' || method === 'PUT') {
      if (!body) {
        errors.push('Request body is required for POST/PUT requests');
      }
    }

    // Path-specific validations
    if (path.includes('/auth/login')) {
      if (!body?.email) {
        errors.push('Email is required');
      }
      if (!body?.password) {
        errors.push('Password is required');
      }
    }

    if (path.includes('/listings')) {
      if (body?.title && typeof body.title !== 'string') {
        errors.push('Title must be a string');
      }
      if (body?.price && typeof body.price !== 'number') {
        errors.push('Price must be a number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
