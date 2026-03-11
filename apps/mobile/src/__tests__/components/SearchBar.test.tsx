import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchBar } from '../../components/SearchBar';

const mockSearch = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    search: (...args: any[]) => mockSearch(...args),
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
  };

  it('renders the search input', () => {
    const { getByPlaceholderText } = render(<SearchBar {...defaultProps} />);
    expect(getByPlaceholderText('Search for items...')).toBeTruthy();
  });

  it('has search accessibility role', () => {
    const { getByRole } = render(<SearchBar {...defaultProps} />);
    expect(getByRole('search')).toBeTruthy();
  });

  it('calls onChange when text changes', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchBar {...defaultProps} onChange={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search for items...'), 'bike');
    expect(onChange).toHaveBeenCalledWith('bike');
  });

  it('calls onSubmit when submit editing fires', () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchBar {...defaultProps} value="mountain bike" onSubmit={onSubmit} />,
    );
    fireEvent(getByPlaceholderText('Search for items...'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('mountain bike');
  });

  it('fetches suggestions after debounce', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { title: 'Mountain Bike' },
        { title: 'Road Bike' },
      ],
    });

    const { rerender, getByText } = render(
      <SearchBar {...defaultProps} value="bi" />,
    );

    // Advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith({ query: 'bi', size: 5 });
    });

    await waitFor(() => {
      expect(getByText('Mountain Bike')).toBeTruthy();
      expect(getByText('Road Bike')).toBeTruthy();
    });
  });

  it('does not fetch when value is less than 2 chars', async () => {
    render(<SearchBar {...defaultProps} value="b" />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not fetch when value is empty', async () => {
    render(<SearchBar {...defaultProps} value="" />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not fetch when value is only whitespace', async () => {
    render(<SearchBar {...defaultProps} value="  " />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    // The trimmed value is empty, so no API call
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('shows "Searching..." during loading', async () => {
    let resolveSearch: (value: any) => void;
    mockSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    const { getByText } = render(
      <SearchBar {...defaultProps} value="bike" />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(getByText('Searching...')).toBeTruthy();
    });

    await act(async () => {
      resolveSearch!({ results: [{ title: 'Bike' }] });
    });
  });

  it('handles search error gracefully', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));

    const { queryByText } = render(
      <SearchBar {...defaultProps} value="bike" />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });

    // No crash, no suggestions shown
    expect(queryByText('Mountain Bike')).toBeNull();
  });

  it('selects a suggestion and calls onChange + onSubmit', async () => {
    mockSearch.mockResolvedValue({
      results: [{ title: 'Mountain Bike' }],
    });

    const onChange = jest.fn();
    const onSubmit = jest.fn();

    const { getByText } = render(
      <SearchBar {...defaultProps} value="mount" onChange={onChange} onSubmit={onSubmit} />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(getByText('Mountain Bike')).toBeTruthy();
    });

    fireEvent.press(getByText('Mountain Bike'));
    expect(onChange).toHaveBeenCalledWith('Mountain Bike');
    expect(onSubmit).toHaveBeenCalledWith('Mountain Bike');
  });
});
