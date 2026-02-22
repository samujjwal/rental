import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/api/authContext';
import { TabNavigator } from './src/navigation/TabNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { linkingConfig } from './src/navigation/linking';
import { colors } from './src/theme';

// Auth screens
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';

// Modal & detail screens
import { ListingScreen } from './src/screens/ListingScreen';
import { BookingDetailScreen } from './src/screens/BookingDetailScreen';
import { BookingFlowScreen } from './src/screens/BookingFlowScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { CreateListingScreen } from './src/screens/CreateListingScreen';
import { EditListingScreen } from './src/screens/EditListingScreen';
import { MessageThreadScreen } from './src/screens/MessageThreadScreen';
import { ReviewsScreen } from './src/screens/ReviewsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SettingsProfileScreen } from './src/screens/SettingsProfileScreen';
import { SettingsNotificationsScreen } from './src/screens/SettingsNotificationsScreen';
import { SettingsIndexScreen } from './src/screens/SettingsIndexScreen';
import { OwnerDashboardScreen } from './src/screens/OwnerDashboardScreen';
import { OwnerListingsScreen } from './src/screens/OwnerListingsScreen';
import { OwnerCalendarScreen } from './src/screens/OwnerCalendarScreen';
import { OwnerEarningsScreen } from './src/screens/OwnerEarningsScreen';
import { OwnerInsightsScreen } from './src/screens/OwnerInsightsScreen';
import { OwnerPerformanceScreen } from './src/screens/OwnerPerformanceScreen';
import { RenterDashboardScreen } from './src/screens/RenterDashboardScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EarningsScreen } from './src/screens/EarningsScreen';
import { PaymentsScreen } from './src/screens/PaymentsScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { BecomeOwnerScreen } from './src/screens/BecomeOwnerScreen';
import { ProfileViewScreen } from './src/screens/ProfileViewScreen';
import { DisputeCreateScreen } from './src/screens/DisputeCreateScreen';
import { DisputeDetailScreen } from './src/screens/DisputeDetailScreen';
import { DisputesScreen } from './src/screens/DisputesScreen';
import { OrganizationsScreen } from './src/screens/OrganizationsScreen';
import { OrganizationCreateScreen } from './src/screens/OrganizationCreateScreen';
import { OrganizationSettingsScreen } from './src/screens/OrganizationSettingsScreen';
import { OrganizationMembersScreen } from './src/screens/OrganizationMembersScreen';
import { InsuranceScreen } from './src/screens/InsuranceScreen';
import { InsuranceUploadScreen } from './src/screens/InsuranceUploadScreen';

// Static/info screens
import { AboutScreen } from './src/screens/AboutScreen';
import { CareersScreen } from './src/screens/CareersScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { PressScreen } from './src/screens/PressScreen';
import { HowItWorksScreen } from './src/screens/HowItWorksScreen';
import { OwnerGuideScreen } from './src/screens/OwnerGuideScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import { SafetyScreen } from './src/screens/SafetyScreen';
import { TermsScreen } from './src/screens/TermsScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { CookiesScreen } from './src/screens/CookiesScreen';

export type RootStackParamList = {
  // Auth group
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;

  // Main tab navigator
  Main: undefined;

  // Detail & modal screens
  Listing: { listingId: string };
  BookingDetail: { bookingId: string };
  BookingFlow: { listingId?: string };
  Checkout: { bookingId?: string };
  CreateListing: undefined;
  EditListing: { listingId: string };
  MessageThread: { conversationId: string };
  Reviews: undefined;
  Settings: undefined;
  SettingsProfile: undefined;
  SettingsNotifications: undefined;
  SettingsIndex: undefined;
  OwnerDashboard: undefined;
  OwnerListings: undefined;
  OwnerCalendar: undefined;
  OwnerEarnings: undefined;
  OwnerInsights: undefined;
  OwnerPerformance: undefined;
  RenterDashboard: undefined;
  Dashboard: undefined;
  Earnings: undefined;
  Payments: undefined;
  Favorites: undefined;
  BecomeOwner: undefined;
  ProfileView: { userId: string };
  DisputeCreate: { bookingId: string };
  DisputeDetail: { disputeId: string };
  Disputes: undefined;
  Organizations: undefined;
  OrganizationCreate: undefined;
  OrganizationSettings: { organizationId: string };
  OrganizationMembers: { organizationId: string };
  Insurance: undefined;
  InsuranceUpload: undefined;

  // Static screens
  About: undefined;
  Careers: undefined;
  Contact: undefined;
  Press: undefined;
  HowItWorks: undefined;
  OwnerGuide: undefined;
  Help: undefined;
  Safety: undefined;
  Terms: undefined;
  Privacy: undefined;
  Cookies: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerBackTitleVisible: false }}>
      {!user ? (
        // Auth screens — no header, full-screen
        <Stack.Group screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          {/* Allow browsing without auth */}
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Group>
      ) : (
        <>
          {/* Main tab navigator */}
          <Stack.Screen
            name="Main"
            component={TabNavigator}
            options={{ headerShown: false }}
          />

          {/* Auth screens accessible for re-login */}
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </Stack.Group>
        </>
      )}

      {/* Detail screens — always accessible */}
      <Stack.Group>
        <Stack.Screen name="Listing" component={ListingScreen} options={{ title: 'Listing' }} />
        <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
        <Stack.Screen name="BookingFlow" component={BookingFlowScreen} options={{ title: 'Book' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'Create Listing' }} />
        <Stack.Screen name="EditListing" component={EditListingScreen} options={{ title: 'Edit Listing' }} />
        <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ title: 'Conversation' }} />
        <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ title: 'Reviews' }} />
        <Stack.Screen name="ProfileView" component={ProfileViewScreen} options={{ title: 'Profile' }} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favorites' }} />
      </Stack.Group>

      {/* Settings screens */}
      <Stack.Group>
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="SettingsIndex" component={SettingsIndexScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="SettingsProfile" component={SettingsProfileScreen} options={{ title: 'Profile Settings' }} />
        <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} options={{ title: 'Notifications' }} />
      </Stack.Group>

      {/* Owner screens */}
      <Stack.Group>
        <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} options={{ title: 'Owner Dashboard' }} />
        <Stack.Screen name="OwnerListings" component={OwnerListingsScreen} options={{ title: 'My Listings' }} />
        <Stack.Screen name="OwnerCalendar" component={OwnerCalendarScreen} options={{ title: 'Calendar' }} />
        <Stack.Screen name="OwnerEarnings" component={OwnerEarningsScreen} options={{ title: 'Earnings' }} />
        <Stack.Screen name="OwnerInsights" component={OwnerInsightsScreen} options={{ title: 'Insights' }} />
        <Stack.Screen name="OwnerPerformance" component={OwnerPerformanceScreen} options={{ title: 'Performance' }} />
        <Stack.Screen name="BecomeOwner" component={BecomeOwnerScreen} options={{ title: 'Become an Owner' }} />
      </Stack.Group>

      {/* Renter & common screens */}
      <Stack.Group>
        <Stack.Screen name="RenterDashboard" component={RenterDashboardScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Earnings' }} />
        <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Payments' }} />
      </Stack.Group>

      {/* Disputes */}
      <Stack.Group>
        <Stack.Screen name="Disputes" component={DisputesScreen} options={{ title: 'Disputes' }} />
        <Stack.Screen name="DisputeCreate" component={DisputeCreateScreen} options={{ title: 'File a Dispute' }} />
        <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} options={{ title: 'Dispute' }} />
      </Stack.Group>

      {/* Organizations */}
      <Stack.Group>
        <Stack.Screen name="Organizations" component={OrganizationsScreen} options={{ title: 'Organizations' }} />
        <Stack.Screen name="OrganizationCreate" component={OrganizationCreateScreen} options={{ title: 'Create Organization' }} />
        <Stack.Screen name="OrganizationSettings" component={OrganizationSettingsScreen} options={{ title: 'Organization Settings' }} />
        <Stack.Screen name="OrganizationMembers" component={OrganizationMembersScreen} options={{ title: 'Team Members' }} />
      </Stack.Group>

      {/* Insurance */}
      <Stack.Group>
        <Stack.Screen name="Insurance" component={InsuranceScreen} options={{ title: 'Insurance' }} />
        <Stack.Screen name="InsuranceUpload" component={InsuranceUploadScreen} options={{ title: 'Upload Documents' }} />
      </Stack.Group>

      {/* Static/info screens */}
      <Stack.Group>
        <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
        <Stack.Screen name="Careers" component={CareersScreen} options={{ title: 'Careers' }} />
        <Stack.Screen name="Contact" component={ContactScreen} options={{ title: 'Contact' }} />
        <Stack.Screen name="Press" component={PressScreen} options={{ title: 'Press' }} />
        <Stack.Screen name="HowItWorks" component={HowItWorksScreen} options={{ title: 'How It Works' }} />
        <Stack.Screen name="OwnerGuide" component={OwnerGuideScreen} options={{ title: 'Owner Guide' }} />
        <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help Center' }} />
        <Stack.Screen name="Safety" component={SafetyScreen} options={{ title: 'Safety' }} />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms of Service' }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="Cookies" component={CookiesScreen} options={{ title: 'Cookie Policy' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <NavigationContainer linking={linkingConfig} fallback={<LoadingScreen />}>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
        <Toast />
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
