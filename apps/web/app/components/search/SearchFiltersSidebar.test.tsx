import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  ChevronDown: () => <svg data-testid="chevron-down" />,
  ChevronUp: () => <svg data-testid="chevron-up" />,
}));

vi.mock('~/components/search/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, onSelect, placeholder }: any) => (
    <input
      data-testid="location-autocomplete"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder || 'Location'}
    />
  ),
}));

import { SearchFiltersSidebar } from './SearchFiltersSidebar';

const defaults = {
  categories: [
    { id: 'cat-1', name: 'Electronics' },
    { id: 'cat-2', name: 'Furniture' },
  ],
  searchParams: {},
  urlSearchParams: new URLSearchParams(),
  locationValue: '',
  conditions: ['new', 'like-new', 'good'],
  maxLocationLength: 100,
  onLocationChange: vi.fn(),
  onLocationSelect: vi.fn(),
  onFilterChange: vi.fn(),
  onApplyLocation: vi.fn(),
  onClearPin: vi.fn(),
  onClose: vi.fn(),
};

function renderSidebar(overrides: Partial<typeof defaults> = {}) {
  return render(<SearchFiltersSidebar {...defaults} {...overrides} />);
}

describe('SearchFiltersSidebar', () => {
  it('renders Filters heading', () => {
    renderSidebar();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    renderSidebar();
    expect(screen.getByLabelText('Close filters')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    fireEvent.click(screen.getByLabelText('Close filters'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    // The backdrop is the first div with aria-hidden
    const backdrop = document.querySelector('[aria-hidden]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders category select with options', () => {
    renderSidebar();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Furniture')).toBeInTheDocument();
  });

  it('calls onFilterChange when category changes', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ onFilterChange });
    const categorySelect = screen.getByText('All Categories').closest('select')!;
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });
    expect(onFilterChange).toHaveBeenCalledWith('category', 'cat-1');
  });

  it('renders location autocomplete', () => {
    renderSidebar();
    expect(screen.getByTestId('location-autocomplete')).toBeInTheDocument();
  });

  it('renders Apply location button', () => {
    renderSidebar();
    expect(screen.getByText('Apply location')).toBeInTheDocument();
  });

  it('calls onApplyLocation when Apply location button clicked', () => {
    const onApplyLocation = vi.fn();
    renderSidebar({ onApplyLocation, locationValue: 'Kathmandu' });
    fireEvent.click(screen.getByText('Apply location'));
    expect(onApplyLocation).toHaveBeenCalledWith('Kathmandu');
  });

  it('renders Clear pin when lat/lng present in URL', () => {
    const params = new URLSearchParams({ lat: '27.7', lng: '85.3' });
    renderSidebar({ urlSearchParams: params });
    expect(screen.getByText('Clear pin')).toBeInTheDocument();
  });

  it('does not render Clear pin without lat/lng', () => {
    renderSidebar();
    expect(screen.queryByText('Clear pin')).not.toBeInTheDocument();
  });

  it('calls onClearPin when Clear pin clicked', () => {
    const onClearPin = vi.fn();
    const params = new URLSearchParams({ lat: '27.7', lng: '85.3' });
    renderSidebar({ urlSearchParams: params, onClearPin });
    fireEvent.click(screen.getByText('Clear pin'));
    expect(onClearPin).toHaveBeenCalled();
  });

  it('renders search radius select', () => {
    renderSidebar();
    expect(screen.getByText('Search Radius')).toBeInTheDocument();
    expect(screen.getByText('25 km')).toBeInTheDocument();
  });

  it('calls onFilterChange when radius changes', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ onFilterChange });
    const radiusSelect = screen.getByText('25 km').closest('select')!;
    fireEvent.change(radiusSelect, { target: { value: '50' } });
    expect(onFilterChange).toHaveBeenCalledWith('radius', '50');
  });

  it('renders price range inputs', () => {
    renderSidebar();
    expect(screen.getByText('Price Range (per day)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Max')).toBeInTheDocument();
  });

  it('calls onFilterChange for min price', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ onFilterChange });
    fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '10' } });
    expect(onFilterChange).toHaveBeenCalledWith('minPrice', '10');
  });

  it('renders condition select', () => {
    renderSidebar();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Any Condition')).toBeInTheDocument();
    expect(screen.getByText('like new')).toBeInTheDocument();
  });

  it('renders quick filter checkboxes', () => {
    renderSidebar();
    expect(screen.getByText('Instant Booking')).toBeInTheDocument();
    expect(screen.getByText('Delivery Available')).toBeInTheDocument();
  });

  it('calls onFilterChange for instant booking toggle', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ onFilterChange });
    const checkbox = screen.getByText('Instant Booking').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onFilterChange).toHaveBeenCalledWith('instantBooking', 'true');
  });
});
