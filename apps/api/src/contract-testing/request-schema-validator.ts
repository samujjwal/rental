import { Injectable } from '@nestjs/common';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class RequestSchemaValidator {
  async validate(path: string, method: string, data: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (method === 'POST' || method === 'PUT') {
      if (!data || Object.keys(data).length === 0) {
        errors.push('Request body is required');
      }
    }

    // Registration validation
    if (path === '/api/auth/register' && method === 'POST') {
      if (!data?.email) errors.push('Email is required');
      if (!data?.password) errors.push('Password is required');
      if (!data?.firstName) errors.push('First name is required');
      if (!data?.lastName) errors.push('Last name is required');

      if (data?.email && !this.isValidEmail(data.email)) {
        errors.push('Invalid email format');
      }

      if (data?.password && data.password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }
    }

    // Listing validation
    if (path === '/api/listings' && method === 'POST') {
      if (!data?.title) errors.push('Title is required');
      if (!data?.description) errors.push('Description is required');
      if (data?.price === undefined) errors.push('Price is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
