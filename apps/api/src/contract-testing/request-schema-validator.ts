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
      if (data?.price !== undefined && typeof data.price !== 'number') {
        errors.push('Price must be a number');
      }
      if (data?.price !== undefined && data.price < 0) {
        errors.push('Price must be non-negative');
      }
    }

    // Booking validation
    if (path === '/api/bookings' && method === 'POST') {
      if (!data?.listingId) errors.push('Listing ID is required');
      if (!data?.startDate) errors.push('Start date is required');
      if (!data?.endDate) errors.push('End date is required');
      if (data?.startDate && data?.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (end <= start) errors.push('End date must be after start date');
      }
    }

    // Message validation
    if (path === '/api/messages' && method === 'POST') {
      if (!data?.recipientId) errors.push('Recipient ID is required');
      if (!data?.content) errors.push('Message content is required');
      if (data?.content && data.content.length > 5000) {
        errors.push('Message content exceeds maximum length');
      }
    }

    // Review validation
    if (path === '/api/reviews' && method === 'POST') {
      if (!data?.bookingId) errors.push('Booking ID is required');
      if (data?.rating === undefined) errors.push('Rating is required');
      if (data?.rating !== undefined) {
        if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
          errors.push('Rating must be a number between 1 and 5');
        }
      }
    }

    // Payment validation
    if (path === '/api/payments/intent' && method === 'POST') {
      if (!data?.bookingId) errors.push('Booking ID is required');
      if (!data?.amount) errors.push('Amount is required');
      if (data?.amount !== undefined && (typeof data.amount !== 'number' || data.amount <= 0)) {
        errors.push('Amount must be a positive number');
      }
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
