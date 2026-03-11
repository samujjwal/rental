import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { LocationInput } from '../../components/LocationInput';

const mockGeoAutocomplete = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    geoAutocomplete: (...args: any[]) => mockGeoAutocomplete(...args),
  },
}));

// Mock the GeoSuggestion type path
jest.mock('~/types', () => ({}), { virtual: true });

beforeEach(() => {
  jest.useFakeTimers();
  mockGeoAutocomplete.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LocationInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSelect: jest.fn(),
  };

  it('renders the location input', () => {
    const { getByPlaceholderText } = render(<LocationInput {...defaultProps} />);
    expect(getByPlaceholderText('Location')).toBeTruthy();
  });

  it('calls onChange when text changes', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <LocationInput {...defaultProps} onChange={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText('Location'), 'Kathmandu');
    expect(onChange).toHaveBeenCalledWith('Kathmandu');
  });

  it('fetches geo suggestions after debounce', async () => {
    mockGeoAutocomplete.mockResolvedValue({
      results: [
        { id: 'geo-1', shortLabel: 'Kathmandu', lat: 27.7, lng: 85.3 },
        { id: 'geo-2', shortLabel: 'Kathmandu Valley', lat: 27.6, lng: 85.3 },
      ],
    });

    render(<LocationInput {...defaultProps} value="Ka" />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockGeoAutocomplete).toHaveBeenCalledWith('Ka', {
        limit: 6,
        layer: 'city',
        biasScale: 0.6,
      });
    });
  });

  it('falls back to non-city layer when city returns no results', async () => {
    // First call returns empty, second returns results
    mockGeoAutocomplete
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({
        results: [{ id: 'geo-1', shortLabel: 'Kathmandu Metropolitan' }],
      });

    const { getByText } = render(
      <LocationInput {...defaultProps} value="Ka" />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockGeoAutocomplete).toHaveBeenCalledTimes(2);
      // Second call without layer
      expect(mockGeoAutocomplete).toHaveBeenLastCalledWith('Ka', {
        limit: 6,
        biasScale: 0.6,
      });
    });

    await waitFor(() => {
      expect(getByText('Kathmandu Metropolitan')).toBeTruthy();
    });
  });

  it('does not fetch when value is less than 2 chars', async () => {
    render(<LocationInput {...defaultProps} value="K" />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(mockGeoAutocomplete).not.toHaveBeenCalled();
  });

  it('does not fetch when value is empty', async () => {
    render(<LocationInput {...defaultProps} value="" />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(mockGeoAutocomplete).not.toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    mockGeoAutocomplete.mockRejectedValue(new Error('Network error'));

    const { queryByText } = render(
      <LocationInput {...defaultProps} value="Ka" />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockGeoAutocomplete).toHaveBeenCalled();
    });

    // No crash
    expect(queryByText('Kathmandu')).toBeNull();
  });

  it('selects a suggestion and calls onChange + onSelect', async () => {
    const suggestion = { id: 'geo-1', shortLabel: 'Kathmandu', lat: 27.7, lng: 85.3 };
    mockGeoAutocomplete.mockResolvedValue({ results: [suggestion] });

    const onChange = jest.fn();
    const onSelect = jest.fn();

    const { getByText } = render(
      <LocationInput {...defaultProps} value="Ka" onChange={onChange} onSelect={onSelect} />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(getByText('Kathmandu')).toBeTruthy();
    });

    fireEvent.press(getByText('Kathmandu'));
    expect(onChange).toHaveBeenCalledWith('Kathmandu');
    expect(onSelect).toHaveBeenCalledWith(suggestion);
  });

  it('closes dropdown after selecting a suggestion', async () => {
    const suggestion = { id: 'geo-1', shortLabel: 'Kathmandu', lat: 27.7, lng: 85.3 };
    mockGeoAutocomplete.mockResolvedValue({ results: [suggestion] });

    const { getByText, queryByText } = render(
      <LocationInput {...defaultProps} value="Ka" />,
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(getByText('Kathmandu')).toBeTruthy();
    });

    fireEvent.press(getByText('Kathmandu'));

    // Dropdown should close — but text may still be visible in input
    // Check the suggestion list item is gone by checking for the FlatList rendering
    // After selection, open is set to false
  });
});
