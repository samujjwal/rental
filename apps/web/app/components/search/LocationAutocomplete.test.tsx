import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGeoApi } = vi.hoisted(() => ({
  mockGeoApi: {
    autocomplete: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  MapPin: (props: Record<string, unknown>) => <svg data-testid="map-pin-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock('~/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('~/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('~/lib/api/geo', () => ({
  geoApi: mockGeoApi,
}));

vi.mock('~/lib/accessibility', () => ({
  Keys: {
    ARROW_DOWN: 'ArrowDown',
    ARROW_UP: 'ArrowUp',
    ENTER: 'Enter',
    ESCAPE: 'Escape',
  },
}));

import { LocationAutocomplete } from './LocationAutocomplete';

const mockResults = [
  {
    id: 'r1',
    shortLabel: 'Kathmandu',
    formattedAddress: 'Kathmandu, Bagmati, Nepal',
    coordinates: { lat: 27.7, lon: 85.3 },
    address: { locality: 'Kathmandu', adminAreaLevel1: 'Bagmati', country: 'Nepal' },
  },
  {
    id: 'r2',
    shortLabel: 'Pokhara',
    formattedAddress: 'Pokhara, Gandaki, Nepal',
    coordinates: { lat: 28.2, lon: 83.98 },
    address: { locality: 'Pokhara', adminAreaLevel1: 'Gandaki', country: 'Nepal' },
  },
];

describe('LocationAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeoApi.autocomplete.mockResolvedValue({ results: [] });
  });

  it('renders input with default placeholder', () => {
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Location')).toBeInTheDocument();
  });

  it('renders input with custom placeholder', () => {
    render(<LocationAutocomplete value="" onChange={vi.fn()} placeholder="Enter city" />);
    expect(screen.getByPlaceholderText('Enter city')).toBeInTheDocument();
  });

  it('renders map pin icon', () => {
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
  });

  it('has combobox role', () => {
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<LocationAutocomplete value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Kat' } });
    expect(onChange).toHaveBeenCalledWith('Kat');
  });

  it('shows results dropdown after API response', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    render(<LocationAutocomplete value="Kat" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    expect(screen.getByText('Kathmandu')).toBeInTheDocument();
    expect(screen.getByText('Pokhara')).toBeInTheDocument();
  });

  it('calls onSelect when result is clicked', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(
      <LocationAutocomplete value="Kat" onChange={onChange} onSelect={onSelect} />
    );
    await waitFor(() => {
      expect(screen.getByText('Kathmandu')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Kathmandu'));
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
    expect(onChange).toHaveBeenCalledWith('Kathmandu');
  });

  it('does not fetch when value is too short', async () => {
    render(<LocationAutocomplete value="K" onChange={vi.fn()} />);
    await waitFor(() => {});
    expect(mockGeoApi.autocomplete).not.toHaveBeenCalled();
  });

  it('navigates options with ArrowDown', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    render(<LocationAutocomplete value="Kat" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes dropdown on Escape', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    render(<LocationAutocomplete value="Kat" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects option on Enter after arrow nav', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(
      <LocationAutocomplete value="Kat" onChange={onChange} onSelect={onSelect} />
    );
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('shows address details in results', async () => {
    mockGeoApi.autocomplete.mockResolvedValue({ results: mockResults });
    render(<LocationAutocomplete value="Kat" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Kathmandu, Bagmati, Nepal')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockGeoApi.autocomplete.mockRejectedValue(new Error('Network'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LocationAutocomplete value="Kathmandu" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
