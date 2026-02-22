import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors, spacing } from '../theme';

export type TabParamList = {
  HomeTab: undefined;
  SearchTab: { query?: string; location?: string; lat?: number; lon?: number; radius?: number };
  BookingsTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    HomeTab: '🏠',
    SearchTab: '🔍',
    BookingsTab: '📅',
    MessagesTab: '💬',
    ProfileTab: '👤',
  };
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="SearchTab" component={SearchScreen} options={{ tabBarLabel: 'Search' }} />
      <Tab.Screen name="BookingsTab" component={BookingsScreen} options={{ tabBarLabel: 'Bookings' }} />
      <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
  },
});
