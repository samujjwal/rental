import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../../screens/HomeScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

// Mock LocationInput and SearchBar
jest.mock('../../components/LocationInput', () => ({
  LocationInput: ({ value, onChange, onSelect }: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="location-input"
        value={value}
        onChangeText={onChange}
        placeholder="Location"
      />
    );
  },
}));

jest.mock('../../components/SearchBar', () => ({
  SearchBar: ({ value, onChange, onSubmit }: any) => {
    const { TextInput, Pressable, Text } = require('react-native');
    return (
      <>
        <TextInput
          testID="search-input"
          value={value}
          onChangeText={onChange}
          placeholder="Search"
        />
        <Pressable testID="search-submit" onPress={() => onSubmit(value)}>
          <Text>Search</Text>
        </Pressable>
      </>
    );
  },
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<HomeScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Find your next rental')).toBeTruthy();
  });

  it('renders search bar and location input', () => {
    render(<HomeScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('search-input')).toBeTruthy();
    expect(screen.getByTestId('location-input')).toBeTruthy();
  });

  it('navigates to Search on submit', () => {
    render(<HomeScreen navigation={mockNavigation} route={mockRoute} />);
    const searchInput = screen.getByTestId('search-input');
    fireEvent.changeText(searchInput, 'apartment');
    fireEvent.press(screen.getByTestId('search-submit'));

    expect(mockNavigate).toHaveBeenCalledWith(
      'SearchTab',
      expect.objectContaining({ query: 'apartment' }),
    );
  });
});
