export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatar: string | null;
  phone: string | null;
  role: "renter" | "owner" | "admin";
  status: "active" | "suspended" | "pending" | "deleted";
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  averageRating: number | null;
  totalReviews: number;
  totalBookings: number;
  totalListings?: number;
  bio?: string;
  responseRate?: number;
  responseTime?: string;
  location?: {
    city: string;
    state: string;
    country: string;
  };
  preferences?: UserPreferences;
  stripeCustomerId?: string;
  stripeConnectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  currency: string;
  language: string;
  timezone: string;
}

export interface UserProfile extends User {
  listings?: {
    id: string;
    title: string;
    images: string[];
    pricePerDay: number;
    rating: number;
  }[];
  reviews?: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: {
      id: string;
      firstName: string;
      lastName: string | null;
      avatar: string | null;
    };
  }[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  location?: {
    city: string;
    state: string;
    country: string;
  };
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  bookingUpdates: boolean;
  messageAlerts: boolean;
  promotions: boolean;
  securityAlerts: boolean;
}
