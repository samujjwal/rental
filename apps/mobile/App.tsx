import React from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { ListingScreen } from "./src/screens/ListingScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { BookingsScreen } from "./src/screens/BookingsScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { CheckoutScreen } from "./src/screens/CheckoutScreen";
import { CreateListingScreen } from "./src/screens/CreateListingScreen";
import { EditListingScreen } from "./src/screens/EditListingScreen";
import { BookingFlowScreen } from "./src/screens/BookingFlowScreen";
import { MessageThreadScreen } from "./src/screens/MessageThreadScreen";
import { ReviewsScreen } from "./src/screens/ReviewsScreen";
import { OwnerDashboardScreen } from "./src/screens/OwnerDashboardScreen";
import { BookingDetailScreen } from "./src/screens/BookingDetailScreen";
import { AboutScreen } from "./src/screens/AboutScreen";
import { CareersScreen } from "./src/screens/CareersScreen";
import { ContactScreen } from "./src/screens/ContactScreen";
import { PressScreen } from "./src/screens/PressScreen";
import { HowItWorksScreen } from "./src/screens/HowItWorksScreen";
import { InsuranceScreen } from "./src/screens/InsuranceScreen";
import { InsuranceUploadScreen } from "./src/screens/InsuranceUploadScreen";
import { OwnerGuideScreen } from "./src/screens/OwnerGuideScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { HelpScreen } from "./src/screens/HelpScreen";
import { SafetyScreen } from "./src/screens/SafetyScreen";
import { TermsScreen } from "./src/screens/TermsScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { CookiesScreen } from "./src/screens/CookiesScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { RenterDashboardScreen } from "./src/screens/RenterDashboardScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { DisputeCreateScreen } from "./src/screens/DisputeCreateScreen";
import { DisputeDetailScreen } from "./src/screens/DisputeDetailScreen";
import { OrganizationsScreen } from "./src/screens/OrganizationsScreen";
import { OrganizationSettingsScreen } from "./src/screens/OrganizationSettingsScreen";
import { OrganizationMembersScreen } from "./src/screens/OrganizationMembersScreen";
import { OrganizationCreateScreen } from "./src/screens/OrganizationCreateScreen";
import { ProfileViewScreen } from "./src/screens/ProfileViewScreen";
import { SettingsProfileScreen } from "./src/screens/SettingsProfileScreen";
import { SettingsNotificationsScreen } from "./src/screens/SettingsNotificationsScreen";
import { BecomeOwnerScreen } from "./src/screens/BecomeOwnerScreen";
import { DisputesScreen } from "./src/screens/DisputesScreen";
import { OwnerListingsScreen } from "./src/screens/OwnerListingsScreen";
import { PaymentsScreen } from "./src/screens/PaymentsScreen";
import { SettingsIndexScreen } from "./src/screens/SettingsIndexScreen";
import { OwnerCalendarScreen } from "./src/screens/OwnerCalendarScreen";
import { OwnerEarningsScreen } from "./src/screens/OwnerEarningsScreen";
import { OwnerInsightsScreen } from "./src/screens/OwnerInsightsScreen";
import { OwnerPerformanceScreen } from "./src/screens/OwnerPerformanceScreen";
import { AuthProvider } from "./src/api/authContext";

export type RootStackParamList = {
  Home: undefined;
  Search: { query?: string; location?: string; lat?: number; lon?: number; radius?: number };
  Listing: { listingId: string };
  Login: undefined;
  Signup: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  Settings: undefined;
  Checkout: { bookingId?: string };
  CreateListing: undefined;
  EditListing: { listingId: string };
  BookingFlow: { listingId?: string };
  MessageThread: { conversationId: string };
  Reviews: undefined;
  OwnerDashboard: undefined;
  BookingDetail: { bookingId: string };
  About: undefined;
  Careers: undefined;
  Contact: undefined;
  Press: undefined;
  HowItWorks: undefined;
  Insurance: undefined;
  InsuranceUpload: undefined;
  OwnerGuide: undefined;
  Earnings: undefined;
  Help: undefined;
  Safety: undefined;
  Terms: undefined;
  Privacy: undefined;
  Cookies: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  Dashboard: undefined;
  RenterDashboard: undefined;
  Favorites: undefined;
  DisputeCreate: { bookingId: string };
  DisputeDetail: { disputeId: string };
  Organizations: undefined;
  OrganizationSettings: { organizationId: string };
  OrganizationMembers: { organizationId: string };
  OrganizationCreate: undefined;
  ProfileView: { userId: string };
  SettingsProfile: undefined;
  SettingsNotifications: undefined;
  BecomeOwner: undefined;
  Disputes: undefined;
  OwnerListings: undefined;
  Payments: undefined;
  SettingsIndex: undefined;
  OwnerCalendar: undefined;
  OwnerEarnings: undefined;
  OwnerInsights: undefined;
  OwnerPerformance: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "GharBatai" }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
            <Stack.Screen name="Listing" component={ListingScreen} options={{ title: "Listing" }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign In" }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Sign Up" }} />
            <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: "Bookings" }} />
            <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: "Messages" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
            <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: "Create Listing" }} />
            <Stack.Screen name="EditListing" component={EditListingScreen} options={{ title: "Edit Listing" }} />
            <Stack.Screen name="BookingFlow" component={BookingFlowScreen} options={{ title: "Book" }} />
            <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ title: "Conversation" }} />
            <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ title: "Reviews" }} />
            <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} options={{ title: "Owner Dashboard" }} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: "Booking" }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ title: "About" }} />
            <Stack.Screen name="Careers" component={CareersScreen} options={{ title: "Careers" }} />
            <Stack.Screen name="Contact" component={ContactScreen} options={{ title: "Contact" }} />
            <Stack.Screen name="Press" component={PressScreen} options={{ title: "Press" }} />
            <Stack.Screen name="HowItWorks" component={HowItWorksScreen} options={{ title: "How It Works" }} />
            <Stack.Screen name="Insurance" component={InsuranceScreen} options={{ title: "Insurance" }} />
            <Stack.Screen name="InsuranceUpload" component={InsuranceUploadScreen} options={{ title: "Insurance Upload" }} />
            <Stack.Screen name="OwnerGuide" component={OwnerGuideScreen} options={{ title: "Owner Guide" }} />
            <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: "Earnings" }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help Center" }} />
            <Stack.Screen name="Safety" component={SafetyScreen} options={{ title: "Safety" }} />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "Terms of Service" }} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Privacy Policy" }} />
            <Stack.Screen name="Cookies" component={CookiesScreen} options={{ title: "Cookies Policy" }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Forgot Password" }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: "Reset Password" }} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
            <Stack.Screen name="RenterDashboard" component={RenterDashboardScreen} options={{ title: "Renter Dashboard" }} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: "Favorites" }} />
            <Stack.Screen name="DisputeCreate" component={DisputeCreateScreen} options={{ title: "File a Dispute" }} />
            <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} options={{ title: "Dispute" }} />
            <Stack.Screen name="Organizations" component={OrganizationsScreen} options={{ title: "Organizations" }} />
            <Stack.Screen name="OrganizationSettings" component={OrganizationSettingsScreen} options={{ title: "Organization Settings" }} />
            <Stack.Screen name="OrganizationMembers" component={OrganizationMembersScreen} options={{ title: "Team Members" }} />
            <Stack.Screen name="OrganizationCreate" component={OrganizationCreateScreen} options={{ title: "Create Organization" }} />
            <Stack.Screen name="ProfileView" component={ProfileViewScreen} options={{ title: "Profile" }} />
            <Stack.Screen name="SettingsProfile" component={SettingsProfileScreen} options={{ title: "Profile Settings" }} />
            <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} options={{ title: "Notifications" }} />
            <Stack.Screen name="BecomeOwner" component={BecomeOwnerScreen} options={{ title: "Become an Owner" }} />
            <Stack.Screen name="Disputes" component={DisputesScreen} options={{ title: "Disputes" }} />
            <Stack.Screen name="OwnerListings" component={OwnerListingsScreen} options={{ title: "My Listings" }} />
            <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: "Payments" }} />
            <Stack.Screen name="SettingsIndex" component={SettingsIndexScreen} options={{ title: "Settings" }} />
            <Stack.Screen name="OwnerCalendar" component={OwnerCalendarScreen} options={{ title: "Owner Calendar" }} />
            <Stack.Screen name="OwnerEarnings" component={OwnerEarningsScreen} options={{ title: "Owner Earnings" }} />
            <Stack.Screen name="OwnerInsights" component={OwnerInsightsScreen} options={{ title: "Owner Insights" }} />
            <Stack.Screen name="OwnerPerformance" component={OwnerPerformanceScreen} options={{ title: "Owner Performance" }} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaView>
  );
}
