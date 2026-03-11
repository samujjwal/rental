/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

// Mock all screen components
jest.mock('../../screens/HomeScreen', () => ({
  HomeScreen: () => {
    const { View, Text } = require('react-native');
    return <View><Text>HomeScreen</Text></View>;
  },
}));
jest.mock('../../screens/SearchScreen', () => ({
  SearchScreen: () => {
    const { View, Text } = require('react-native');
    return <View><Text>SearchScreen</Text></View>;
  },
}));
jest.mock('../../screens/BookingsScreen', () => ({
  BookingsScreen: () => {
    const { View, Text } = require('react-native');
    return <View><Text>BookingsScreen</Text></View>;
  },
}));
jest.mock('../../screens/MessagesScreen', () => ({
  MessagesScreen: () => {
    const { View, Text } = require('react-native');
    return <View><Text>MessagesScreen</Text></View>;
  },
}));
jest.mock('../../screens/ProfileScreen', () => ({
  ProfileScreen: () => {
    const { View, Text } = require('react-native');
    return <View><Text>ProfileScreen</Text></View>;
  },
}));

import { TabNavigator } from '../../navigation/TabNavigator';

function renderWithNavigation() {
  return render(
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>,
  );
}

describe('TabNavigator', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderWithNavigation();
    expect(toJSON()).toBeTruthy();
  });

  it('shows Home tab label', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('Home')).toBeTruthy();
  });

  it('shows Search tab label', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('Search')).toBeTruthy();
  });

  it('shows Bookings tab label', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('Bookings')).toBeTruthy();
  });

  it('shows Messages tab label', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('Messages')).toBeTruthy();
  });

  it('shows Profile tab label', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('Profile')).toBeTruthy();
  });

  it('renders all 5 tab icons', () => {
    const { getAllByText } = renderWithNavigation();
    // Tab icons are rendered by the Ionicons mock as 'Ionicons' text nodes.
    // Each tab has one icon; there are 5 tabs, so at least 5 occurrences.
    expect(getAllByText('Ionicons').length).toBeGreaterThanOrEqual(5);
  });

  it('renders SearchScreen as default screen (Search-first for authenticated users)', () => {
    const { getByText } = renderWithNavigation();
    expect(getByText('SearchScreen')).toBeTruthy();
  });
});
