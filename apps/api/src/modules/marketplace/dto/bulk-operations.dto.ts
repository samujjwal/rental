export interface BulkUpdateListingsDto {
  listingIds: string[];
  updates: {
    status?: 'AVAILABLE' | 'UNAVAILABLE' | 'ARCHIVED';
    basePrice?: number;
    instantBookable?: boolean;
    minStayNights?: number;
    maxStayNights?: number;
  };
}

export interface BulkUpdateAvailabilityDto {
  listingIds: string[];
  action: 'BLOCK' | 'UNBLOCK' | 'SET_PRICE';
  dateRange: {
    startDate: string;
    endDate: string;
  };
  price?: number;
  reason?: string;
}

export interface BulkRespondToBookingsDto {
  bookingIds: string[];
  action: 'ACCEPT' | 'DECLINE' | 'MESSAGE';
  message?: string;
  declineReason?: string;
}

export interface BulkArchiveListingsDto {
  listingIds: string[];
  reason?: string;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}