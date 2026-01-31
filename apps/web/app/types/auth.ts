export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  role: "renter" | "owner" | "admin";
  verified: boolean;
  rating: number | null;
  totalReviews: number;
  totalBookings: number;
  totalListings: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: "renter" | "owner";
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}
