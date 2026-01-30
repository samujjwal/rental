/**
 * Development Auto-Login Utility
 * Automatically logs in test users in development mode
 */

import { sessionStorage } from './auth.server';

export async function createDevSession(email: string, request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3400';
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: 'password123',
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const session = await sessionStorage.getSession(
      request.headers.get('Cookie')
    );
    
    session.set('userId', data.user.id);
    session.set('accessToken', data.accessToken);
    session.set('refreshToken', data.refreshToken);
    session.set('user', data.user);

    return session;
  } catch (error) {
    console.error('Dev auto-login error:', error);
    return null;
  }
}

export const DEV_USERS = {
  admin: 'admin@rental-portal.com',
  support: 'support@rental.local',
  owner1: 'john.owner@rental.local',
  owner2: 'emily.tools@rental.local',
  customer1: 'mike.customer@rental.local',
  customer2: 'lisa.renter@rental.local',
} as const;
