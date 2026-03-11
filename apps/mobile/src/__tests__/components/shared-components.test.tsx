import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// ── ListingCard ──
import { ListingCard } from '../../components/ListingCard';

const mockListing = {
  id: 'l1',
  title: 'Camera DSLR',
  basePrice: 50,
  pricingMode: 'PER_DAY',
  currency: 'NPR',
  city: 'Kathmandu',
  state: 'Bagmati',
  photos: ['https://example.com/photo.jpg'],
  averageRating: 4.5,
  totalReviews: 10,
  condition: 'good',
  featured: false,
  categoryId: 'c1',
} as any;

describe('ListingCard', () => {
  it('renders title and price', () => {
    render(<ListingCard listing={mockListing} onPress={jest.fn()} />);
    expect(screen.getByText('Camera DSLR')).toBeTruthy();
    expect(screen.getByText('Rs. 50/day')).toBeTruthy();
  });

  it('renders location', () => {
    render(<ListingCard listing={mockListing} onPress={jest.fn()} />);
    expect(screen.getByText('Kathmandu, Bagmati')).toBeTruthy();
  });

  it('renders rating when > 0', () => {
    render(<ListingCard listing={mockListing} onPress={jest.fn()} />);
    expect(screen.getByText(/4\.5/)).toBeTruthy();
  });

  it('does not show rating when 0', () => {
    const noRating = { ...mockListing, averageRating: 0 };
    const { queryByText } = render(<ListingCard listing={noRating} onPress={jest.fn()} />);
    expect(queryByText(/\u2B50/)).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<ListingCard listing={mockListing} onPress={onPress} />);
    fireEvent.press(screen.getByAccessibilityHint('Opens listing details'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows favorite button when onToggleFavorite provided', () => {
    const onToggle = jest.fn();
    render(
      <ListingCard
        listing={mockListing}
        onPress={jest.fn()}
        onToggleFavorite={onToggle}
      />,
    );
    const favBtn = screen.getByLabelText('Add to favorites');
    fireEvent.press(favBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows filled heart when isFavorite', () => {
    render(
      <ListingCard
        listing={mockListing}
        onPress={jest.fn()}
        isFavorite
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Remove from favorites')).toBeTruthy();
  });

  it('shows placeholder when no photo', () => {
    const noPhoto = { ...mockListing, photos: [] };
    render(<ListingCard listing={noPhoto} onPress={jest.fn()} />);
    expect(screen.getByText('C')).toBeTruthy(); // First char of title
  });

  it('has accessibility label with title and price', () => {
    render(<ListingCard listing={mockListing} onPress={jest.fn()} />);
    const card = screen.getByAccessibilityHint('Opens listing details');
    expect(card.props.accessibilityLabel).toContain('Camera DSLR');
    expect(card.props.accessibilityLabel).toContain('Rs. 50');
  });
});

// ── ConfirmDialog ──
import { ConfirmDialog } from '../../components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDialog
        visible
        title="Delete?"
        message="This cannot be undone"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Delete?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone')).toBeTruthy();
  });

  it('uses default button texts', () => {
    render(
      <ConfirmDialog
        visible
        title="Confirm"
        message="Sure?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Confirm')).toBeTruthy();
    expect(screen.getByLabelText('Cancel')).toBeTruthy();
  });

  it('uses custom button texts', () => {
    render(
      <ConfirmDialog
        visible
        title="Delete"
        message="Really?"
        confirmText="Yes, Delete"
        cancelText="Go Back"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Yes, Delete')).toBeTruthy();
    expect(screen.getByLabelText('Go Back')).toBeTruthy();
  });

  it('calls onConfirm when confirm pressed', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        visible
        title="Delete"
        message="Sure?"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel pressed', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        visible
        title="Delete"
        message="Sure?"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('adds hint for destructive action', () => {
    render(
      <ConfirmDialog
        visible
        title="Delete"
        message="Permanent"
        destructive
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const confirmBtn = screen.getByLabelText('Confirm');
    expect(confirmBtn.props.accessibilityHint).toBe('This action cannot be undone');
  });
});

// ── ErrorBoundary ──
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Text, View } from 'react-native';

function ThrowError() {
  throw new Error('Test error');
}

describe('ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeAll(() => { console.error = jest.fn(); });
  afterAll(() => { console.error = originalError; });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Text>Child</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<Text>Custom Fallback</Text>}>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom Fallback')).toBeTruthy();
  });

  it('has a retry button', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Try Again')).toBeTruthy();
  });
});

// ── FormContainer ──
import { FormContainer } from '../../components/FormContainer';

describe('FormContainer', () => {
  it('renders children', () => {
    render(
      <FormContainer>
        <Text>Form Content</Text>
      </FormContainer>,
    );
    expect(screen.getByText('Form Content')).toBeTruthy();
  });
});
