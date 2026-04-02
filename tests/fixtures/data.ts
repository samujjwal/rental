import { test as base, expect, Page } from '@playwright/test';

// Test data generators
export function generateTestUser(role: 'renter' | 'owner' | 'admin' = 'renter') {
  const timestamp = Date.now();
  return {
    email: `test-${role}-${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: role.charAt(0).toUpperCase() + role.slice(1),
    phone: `+1234567890${timestamp.toString().slice(-4)}`,
    role
  };
}

export function generateTestListing() {
  const timestamp = Date.now();
  return {
    title: `Test Listing ${timestamp}`,
    description: 'A comprehensive test listing with all required fields',
    category: 'vehicle',
    price: 50,
    currency: 'USD',
    location: 'Test City, Test Country',
    address: '123 Test Street',
    latitude: 40.7128,
    longitude: -74.0060,
    images: ['test-image-1.jpg', 'test-image-2.jpg'],
    features: {
      make: 'TestMake',
      model: 'TestModel',
      year: 2024,
      mileage: 1000
    }
  };
}

export function generateTestBooking() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return {
    startDate: tomorrow.toISOString().split('T')[0],
    endDate: nextWeek.toISOString().split('T')[0],
    message: 'Test booking message',
    totalPrice: 350
  };
}

// API response mocks
export const mockApiResponses = {
  auth: {
    login: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'renter',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: false
      },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    },
    register: {
      user: {
        id: 'new-user-id',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'renter',
        status: 'ACTIVE',
        emailVerified: false,
        phoneVerified: false
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    }
  },
  listings: {
    search: {
      listings: [
        {
          id: 'listing-1',
          title: 'Test Listing 1',
          description: 'First test listing',
          price: 50,
          currency: 'USD',
          category: 'vehicle',
          location: 'Test City',
          images: ['image1.jpg'],
          rating: 4.5,
          reviewsCount: 10,
          owner: {
            id: 'owner-1',
            firstName: 'Owner',
            lastName: 'One'
          }
        }
      ],
      total: 1,
      page: 1,
      totalPages: 1
    },
    detail: {
      id: 'listing-1',
      title: 'Test Listing 1',
      description: 'Detailed description of test listing',
      price: 50,
      currency: 'USD',
      category: 'vehicle',
      location: 'Test City',
      address: '123 Test Street',
      latitude: 40.7128,
      longitude: -74.0060,
      images: ['image1.jpg', 'image2.jpg'],
      rating: 4.5,
      reviewsCount: 10,
      availability: [
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true }
      ],
      owner: {
        id: 'owner-1',
        firstName: 'Owner',
        lastName: 'One',
        rating: 4.8,
        responseRate: 95
      },
      features: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2024,
        mileage: 1000
      }
    }
  },
  bookings: {
    create: {
      id: 'booking-1',
      listingId: 'listing-1',
      renterId: 'renter-1',
      ownerId: 'owner-1',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      totalPrice: 350,
      currency: 'USD',
      status: 'PENDING',
      createdAt: '2024-01-01T00:00:00Z'
    },
    list: [
      {
        id: 'booking-1',
        listing: {
          id: 'listing-1',
          title: 'Test Listing 1',
          images: ['image1.jpg']
        },
        status: 'CONFIRMED',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        totalPrice: 350,
        currency: 'USD'
      }
    ]
  }
};

// Error response mocks
export const mockApiErrors = {
  validation: {
    status: 400,
    data: {
      message: 'Validation failed',
      errors: {
        email: ['Email is required'],
        password: ['Password must be at least 8 characters']
      }
    }
  },
  unauthorized: {
    status: 401,
    data: {
      message: 'Unauthorized access'
    }
  },
  notFound: {
    status: 404,
    data: {
      message: 'Resource not found'
    }
  },
  serverError: {
    status: 500,
    data: {
      message: 'Internal server error'
    }
  }
};

// Test environment configuration
export const testConfig = {
  baseURL: process.env.BASE_URL || 'http://localhost:3401',
  apiURL: process.env.API_URL || 'http://localhost:3400/api',
  timeout: 30000,
  retry: 3
};

// Common test data
export const testUsers = {
  renter: generateTestUser('renter'),
  owner: generateTestUser('owner'),
  admin: generateTestUser('admin')
};

export const testListings = {
  vehicle: generateTestListing(),
  property: { ...generateTestListing(), category: 'property' },
  equipment: { ...generateTestListing(), category: 'equipment' }
};
