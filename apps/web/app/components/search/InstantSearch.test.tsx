import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InstantSearch } from './InstantSearch';
import { BrowserRouter } from 'react-router';

// Mock the listings API
vi.mock('~/lib/api/listings', () => ({
  listingsApi: {
    searchListings: vi.fn(),
  },
}));

// Mock useDebounce to execute immediately in tests
vi.mock('~/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

// Mock prefersReducedMotion
vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => false,
  Keys: {
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
  },
}));

import { listingsApi } from '~/lib/api/listings';

describe('InstantSearch', () => {
  const mockSearchListings = listingsApi.searchListings as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchListings.mockResolvedValue({
      listings: [
        {
          id: '1',
          title: 'Test Listing 1',
          pricePerDay: 50,
          images: ['image1.jpg'],
          location: { city: 'New York', state: 'NY' },
        },
        {
          id: '2',
          title: 'Test Listing 2',
          pricePerDay: 75,
          images: [],
          location: { city: 'Los Angeles', state: 'CA' },
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default placeholder', () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText('Search for items...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(
      <BrowserRouter>
        <InstantSearch placeholder="Find rentals..." />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText('Find rentals...')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('calls search API when input changes', async () => {
    render(
      <BrowserRouter>
        <InstantSearch minChars={2} />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'camera' } });

    await waitFor(() => {
      expect(mockSearchListings).toHaveBeenCalledWith({
        query: 'camera',
        limit: 5,
      });
    });
  });

  it('does not search with less than minChars', async () => {
    render(
      <BrowserRouter>
        <InstantSearch minChars={3} />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ca' } });

    await waitFor(() => {
      expect(mockSearchListings).not.toHaveBeenCalled();
    });
  });

  it('displays search results', async () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Listing 1')).toBeInTheDocument();
      expect(screen.getByText('Test Listing 2')).toBeInTheDocument();
    });
  });

  it('displays loading state', async () => {
    mockSearchListings.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  it('displays error message on search failure', async () => {
    mockSearchListings.mockRejectedValue(new Error('Network error'));

    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Failed to search. Please try again.')).toBeInTheDocument();
    });
  });

  it('clears search when clear button clicked', async () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Listing 1')).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });

  it('handles keyboard navigation', async () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Listing 1')).toBeInTheDocument();
    });

    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant');

    // Navigate up
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    // Press escape to close
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('submits search on Enter key', async () => {
    const onSearch = vi.fn();
    render(
      <BrowserRouter>
        <InstantSearch onSearch={onSearch} />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'camera' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSearch).toHaveBeenCalledWith('camera');
  });

  it('submits search on form submit', async () => {
    const onSearch = vi.fn();
    render(
      <BrowserRouter>
        <InstantSearch onSearch={onSearch} />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'camera' } });
    
    const form = input.closest('form');
    fireEvent.submit(form!);

    expect(onSearch).toHaveBeenCalledWith('camera');
  });

  it('closes dropdown when clicking outside', async () => {
    render(
      <BrowserRouter>
        <div>
          <InstantSearch />
          <div data-testid="outside">Outside</div>
        </div>
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Listing 1')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText('Test Listing 1')).not.toBeInTheDocument();
    });
  });

  it('respects maxResults prop', async () => {
    render(
      <BrowserRouter>
        <InstantSearch maxResults={1} />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockSearchListings).toHaveBeenCalledWith({
        query: 'test',
        limit: 1,
      });
    });
  });

  it('shows "View all results" link', async () => {
    render(
      <BrowserRouter>
        <InstantSearch />
      </BrowserRouter>
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('View all results')).toBeInTheDocument();
    });
  });

  it('autoFocus works correctly', () => {
    render(
      <BrowserRouter>
        <InstantSearch autoFocus />
      </BrowserRouter>
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
  });
});
