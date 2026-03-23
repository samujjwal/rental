/**
 * Test Data Fixtures - Realistic test data for E2E tests
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "renter" | "owner" | "admin";
}

export interface TestListing {
  title: string;
  description: string;
  category: string;
  condition: string;
  dailyRate: string;
  securityDeposit: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  availability: string;
  minRentalDays: string;
  maxRentalDays: string;
  deliveryMethod: string[];
}

export interface TestBooking {
  startDate: string;
  endDate: string;
  guests: string;
  message: string;
}

export interface TestPayment {
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  cardName: string;
}

// Test Users - Realistic profiles (using actual test database credentials)
export const testUsers: Record<string, TestUser> = {
  renter: {
    email: "renter@test.com",
    password: "Test123!@#",
    firstName: "Test",
    lastName: "Renter",
    phone: "+1-555-0101",
    role: "renter",
  },
  owner: {
    email: "owner@test.com",
    password: "Test123!@#",
    firstName: "Test",
    lastName: "Owner",
    phone: "+1-555-0102",
    role: "owner",
  },
  admin: {
    email: "admin@test.com",
    password: "Test123!@#",
    firstName: "Admin",
    lastName: "User",
    phone: "+1-555-0100",
    role: "admin",
  },
  newRenter: {
    email: `test.renter.${Date.now()}@example.com`,
    password: "NewUser123!",
    firstName: "Sarah",
    lastName: "Johnson",
    phone: "+1-555-0103",
    role: "renter",
  },
  newOwner: {
    email: `test.owner.${Date.now()}@example.com`,
    password: "NewOwner123!",
    firstName: "Michael",
    lastName: "Brown",
    phone: "+1-555-0104",
    role: "owner",
  },
};

// Test Listings - Realistic items
export const testListings: Record<string, TestListing> = {
  camera: {
    title: "Canon EOS R5 Mirrorless Camera with 24-105mm Lens",
    description: `Professional full-frame mirrorless camera perfect for photography and videography. 
    
Features:
- 45MP full-frame sensor
- 8K video recording
- In-body image stabilization
- Weather-sealed body
- Includes 24-105mm f/4 L lens
- Battery grip and extra batteries included
- Professional camera bag included

Perfect for: Weddings, events, portraits, landscapes, travel photography.

Pickup available in downtown area or delivery within 20 miles.`,
    category: "Photography",
    condition: "like-new",
    dailyRate: "85.00",
    securityDeposit: "1200.00",
    location: {
      address: "123 Market Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      country: "United States",
    },
    availability: "available",
    minRentalDays: "1",
    maxRentalDays: "30",
    deliveryMethod: ["pickup", "delivery"],
  },
  drone: {
    title: "DJI Mavic 3 Pro Drone with Fly More Combo",
    description: `Professional drone with triple camera system. Includes everything needed for aerial photography and videography.

Contents:
- DJI Mavic 3 Pro drone
- 3 intelligent flight batteries
- Charging hub and adapter
- Extra propellers
- Hard case
- ND filter set
- 1TB memory card

License: FAA Part 107 required for commercial use
Max flight time: 43 minutes
Transmission range: 15km`,
    category: "Photography",
    condition: "excellent",
    dailyRate: "120.00",
    securityDeposit: "2000.00",
    location: {
      address: "456 Tech Blvd",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      country: "United States",
    },
    availability: "available",
    minRentalDays: "2",
    maxRentalDays: "14",
    deliveryMethod: ["pickup"],
  },
  tent: {
    title: "REI Kingdom 6 Family Camping Tent - Sleeps 6",
    description: `Spacious 6-person camping tent perfect for families. Nearly vertical walls for maximum living space.

Specifications:
- Sleeps 6 comfortably
- Floor area: 83.3 sq ft
- Peak height: 75 inches
- Weather-resistant rainfly
- Mud mat included
- Room divider for privacy
- Multiple storage pockets
- E-cable port

Includes:
- Tent with rainfly
- Footprint/groundsheet
- Stakes and guylines
- Setup instructions

Great for: Family camping trips, festivals, outdoor events`,
    category: "Outdoor",
    condition: "good",
    dailyRate: "35.00",
    securityDeposit: "150.00",
    location: {
      address: "789 Mountain View Rd",
      city: "Denver",
      state: "CO",
      zipCode: "80202",
      country: "United States",
    },
    availability: "available",
    minRentalDays: "2",
    maxRentalDays: "21",
    deliveryMethod: ["pickup", "delivery", "shipping"],
  },
};

// Test Bookings - Realistic scenarios
export const testBookings: Record<string, TestBooking> = {
  weekend: {
    startDate: getDateString(7), // 7 days from now
    endDate: getDateString(9), // 9 days from now
    guests: "2",
    message: "Looking forward to using this for a weekend photography workshop. Will take good care of it!",
  },
  week: {
    startDate: getDateString(14),
    endDate: getDateString(21),
    guests: "1",
    message: "Need this for a week-long project. I have insurance and will handle with care.",
  },
  extended: {
    startDate: getDateString(30),
    endDate: getDateString(60),
    guests: "4",
    message: "Planning a month-long camping trip across national parks. Happy to provide references.",
  },
};

// Test Payment Cards
export const testPaymentCards = {
  valid: {
    cardNumber: "4242424242424242", // Stripe test card
    cardExpiry: "12/28",
    cardCvc: "123",
    cardName: "Jane Smith",
  },
  declined: {
    cardNumber: "4000000000000002", // Stripe test card - declined
    cardExpiry: "12/28",
    cardCvc: "123",
    cardName: "Jane Smith",
  },
  insufficientFunds: {
    cardNumber: "4000000000009995", // Stripe test card - insufficient funds
    cardExpiry: "12/28",
    cardCvc: "123",
    cardName: "Jane Smith",
  },
};

// Invalid form data for testing validation
export const invalidFormData = {
  emails: [
    { value: "", error: "Email is required" },
    { value: "invalid", error: "Invalid email" },
    { value: "test@", error: "Invalid email" },
    { value: "@example.com", error: "Invalid email" },
    { value: "test..test@example.com", error: "Invalid email" },
  ],
  passwords: [
    { value: "", error: "Password is required" },
    { value: "123", error: "Password must be at least 8 characters" },
    { value: "password", error: "Password must contain uppercase, lowercase, number, and special character" },
    { value: "PASSWORD123", error: "Password must contain lowercase letter" },
  ],
  phones: [
    { value: "", error: "Phone is required" },
    { value: "123", error: "Invalid phone number" },
    { value: "abcdefghij", error: "Invalid phone number" },
  ],
  prices: [
    { value: "", error: "Price is required" },
    { value: "-10", error: "Price must be positive" },
    { value: "abc", error: "Price must be a number" },
    { value: "0", error: "Price must be greater than 0" },
  ],
  dates: [
    { value: "", error: "Date is required" },
    { value: getDateString(-5), error: "Date must be in the future" },
  ],
};

// Helper function to get date string
function getDateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

// Organization test data
export const testOrganization = {
  name: "Acme Rental Co.",
  description: "Professional equipment rental company specializing in photography and video gear.",
  website: "https://acmerental.example.com",
  inviteEmail: "colleague@example.com",
};

// Review test data
export const testReviews = {
  positive: {
    rating: 5,
    title: "Excellent experience!",
    comment: "The equipment was in perfect condition and exactly as described. Owner was very responsive and professional. Highly recommend!",
  },
  negative: {
    rating: 2,
    title: "Not as expected",
    comment: "The item was not as described and had some issues that weren't mentioned in the listing.",
  },
  moderate: {
    rating: 3,
    title: "Okay experience",
    comment: "The rental was fine but there were some minor issues with pickup timing.",
  },
};

// Dispute test data
export const testDisputes = {
  damage: {
    type: "damage",
    description: "Item was returned with visible scratches on the lens. This was not present when rented out.",
    evidence: "Photos attached showing the damage.",
  },
  notReceived: {
    type: "item_not_received",
    description: "The item was never delivered despite confirmation. Multiple attempts to contact owner failed.",
    evidence: "Screenshots of unanswered messages.",
  },
};

// Login helper function for new test files
import type { Page } from '@playwright/test';

export async function loginAs(
  page: Page,
  email: string,
  role: 'USER' | 'HOST' | 'ADMIN'
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');
  
  // Fill email and password based on role
  let password = 'password123'; // Default test password
  
  if (email.includes('admin')) {
    password = 'admin123';
  } else if (email.includes('owner')) {
    password = 'owner123';
  }
  
  // Fill form
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  
  await emailInput.fill(email);
  await passwordInput.fill(password);
  
  // Submit
  await page.locator('button[type="submit"]').click();
  
  // Wait for redirect
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}
