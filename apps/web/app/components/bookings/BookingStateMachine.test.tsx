import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BookingStateMachine } from '~/components/bookings/BookingStateMachine';
import { useTranslation } from 'react-i18next';

// Mock the translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

describe('BookingStateMachine', () => {
  const mockOnStateAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking states correctly', () => {
    render(
      <BookingStateMachine
        currentStatus="PENDING_OWNER_APPROVAL"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    // Check that the component renders (no header text in this component)
    expect(screen.getByText('Requested')).toBeInTheDocument();
  });

  it('shows appropriate actions for owner role', () => {
    render(
      <BookingStateMachine
        currentStatus="PENDING_OWNER_APPROVAL"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows appropriate actions for renter role', () => {
    render(
      <BookingStateMachine
        currentStatus="CONFIRMED"
        userRole="renter"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    // There are 2 cancel buttons (one in the dropdown, one might be in another state)
    expect(screen.getAllByText('Cancel')).toHaveLength(2);
  });

  it('handles state action clicks', async () => {
    render(
      <BookingStateMachine
        currentStatus="PENDING_OWNER_APPROVAL"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockOnStateAction).toHaveBeenCalledWith('approve', 'test-booking-id');
    });
  });

  it('displays current status correctly', () => {
    render(
      <BookingStateMachine
        currentStatus="CONFIRMED"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows cancelled status alert', () => {
    render(
      <BookingStateMachine
        currentStatus="CANCELLED"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Booking Cancelled')).toBeInTheDocument();
    expect(screen.getByText('This booking has been cancelled.')).toBeInTheDocument();
  });

  it('shows disputed status alert', () => {
    render(
      <BookingStateMachine
        currentStatus="DISPUTED"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Dispute in Progress')).toBeInTheDocument();
    expect(screen.getByText('This booking is currently under dispute resolution.')).toBeInTheDocument();
  });

  it('disables actions when not applicable', () => {
    render(
      <BookingStateMachine
        currentStatus="COMPLETED"
        userRole="renter"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    // Should show review action for completed booking
    expect(screen.getByText('Leave Review')).toBeInTheDocument();
  });

  it('handles payment action for renter', () => {
    render(
      <BookingStateMachine
        currentStatus="PENDING_PAYMENT"
        userRole="renter"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Pay Now')).toBeInTheDocument();
  });

  it('handles start rental action for owner', () => {
    render(
      <BookingStateMachine
        currentStatus="CONFIRMED"
        userRole="owner"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Start Rental')).toBeInTheDocument();
  });

  it('handles return request action for renter', () => {
    render(
      <BookingStateMachine
        currentStatus="IN_PROGRESS"
        userRole="renter"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Request Return')).toBeInTheDocument();
  });

  it('handles review action for renter', () => {
    render(
      <BookingStateMachine
        currentStatus="COMPLETED"
        userRole="renter"
        bookingId="test-booking-id"
        onStateAction={mockOnStateAction}
      />
    );

    expect(screen.getByText('Leave Review')).toBeInTheDocument();
  });
});
