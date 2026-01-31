# Technology Reference Guide — Best Practices & Code Patterns

**Quick reference for React, React Native, NestJS, Prisma, and stack-specific patterns**

---

## Table of Contents

1. [TypeScript Best Practices](#1-typescript-best-practices)
2. [React & React Router v7](#2-react--react-router-v7)
3. [React Native & Expo](#3-react-native--expo)
4. [TailwindCSS](#4-tailwindcss)
5. [NestJS Backend Patterns](#5-nestjs-backend-patterns)
6. [Prisma ORM](#6-prisma-orm)
7. [State Management (Zustand & Redux)](#7-state-management-zustand--redux)
8. [Socket.io Real-time](#8-socketio-real-time)
9. [Testing Patterns](#9-testing-patterns)
10. [Security Best Practices](#10-security-best-practices)
11. [Performance Optimization](#11-performance-optimization)
12. [Error Handling](#12-error-handling)

---

## 1. TypeScript Best Practices

### ✅ DO: Use Strict Type Safety

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### ✅ DO: Define Clear Interfaces and Types

```typescript
// Good: Explicit types with readonly where appropriate
interface User {
  readonly id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
}

type UserRole = 'ADMIN' | 'OWNER' | 'RENTER';

// Good: Use utility types
type CreateUserDto = Omit<User, 'id' | 'createdAt'>;
type UpdateUserDto = Partial<CreateUserDto>;
type UserResponse = Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;

// Good: Discriminated unions for state
type LoadingState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### ❌ DON'T: Use `any` or Type Assertions Unnecessarily

```typescript
// Bad
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// Good
function processData<T extends { value: unknown }>(data: T[]): unknown[] {
  return data.map(item => item.value);
}

// Bad: Unnecessary type assertion
const value = someFunction() as string;

// Good: Type guard
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

const value = someFunction();
if (isString(value)) {
  // TypeScript knows value is string here
  console.log(value.toUpperCase());
}
```

### ✅ DO: Use Enums Wisely

```typescript
// Good: Use const enums for better tree-shaking
export const enum BookingStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

// Or use string literal unions for better JSON serialization
export type BookingStatus = 
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED';

// Helper to get all values
export const BOOKING_STATUSES = [
  'DRAFT',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED'
] as const;
```

### ✅ DO: Use Generic Constraints

```typescript
// Good: Generic with constraints
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

// Good: Multiple constraints
function merge<T extends object, U extends object>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}
```

---

## 2. React & React Router v7

### ✅ DO: Use Framework Mode with Loaders and Actions

```typescript
// routes/listings.$id.tsx
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { json, redirect } from 'react-router';

// Loader: Fetch data server-side
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;
  
  // Parse URL params
  const url = new URL(request.url);
  const includeReviews = url.searchParams.get('reviews') === 'true';
  
  try {
    const listing = await db.listing.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, firstName: true, avatar: true, rating: true }
        },
        photos: true,
        reviews: includeReviews ? {
          include: { renter: { select: { firstName: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10
        } : false
      }
    });

    if (!listing) {
      throw new Response('Not Found', { status: 404 });
    }

    return json({ listing, includeReviews });
  } catch (error) {
    console.error('Error loading listing:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
}

// Action: Handle form submissions
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'book') {
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const guests = parseInt(formData.get('guests') as string);

    // Validate
    if (!startDate || !endDate || isNaN(guests)) {
      return json({ error: 'Invalid booking data' }, { status: 400 });
    }

    // Create booking
    const booking = await createBooking({
      listingId: params.id!,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      guests
    });

    return redirect(`/bookings/${booking.id}`);
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
}

// Component
export default function ListingDetail() {
  const { listing } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">{listing.title}</h1>
      
      <Form method="post" className="mt-8">
        <input type="hidden" name="intent" value="book" />
        
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            name="startDate"
            required
            className="rounded-md border-gray-300"
          />
          <input
            type="date"
            name="endDate"
            required
            className="rounded-md border-gray-300"
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Booking...' : 'Book Now'}
        </button>
        
        {actionData?.error && (
          <p className="mt-2 text-red-600">{actionData.error}</p>
        )}
      </Form>
    </div>
  );
}
```

### ✅ DO: Optimize with Prefetching

```typescript
// Use Link with prefetch for better UX
import { Link } from 'react-router';

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      prefetch="intent" // Prefetch on hover/focus
      className="block hover:shadow-lg transition-shadow"
    >
      <img src={listing.photos[0]?.url} alt={listing.title} />
      <h3 className="font-semibold">{listing.title}</h3>
      <p className="text-gray-600">${listing.basePrice}/day</p>
    </Link>
  );
}
```

### ✅ DO: Use Custom Hooks for Logic Reuse

```typescript
// hooks/useBooking.ts
import { useState, useCallback } from 'react';
import { useFetcher } from 'react-router';

export function useBooking(listingId: string) {
  const fetcher = useFetcher();
  const [dates, setDates] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  const checkAvailability = useCallback(async () => {
    if (!dates.start || !dates.end) return;

    fetcher.load(
      `/api/listings/${listingId}/availability?start=${dates.start.toISOString()}&end=${dates.end.toISOString()}`
    );
  }, [listingId, dates, fetcher]);

  const createBooking = useCallback((formData: FormData) => {
    fetcher.submit(formData, {
      method: 'post',
      action: `/listings/${listingId}`
    });
  }, [listingId, fetcher]);

  return {
    dates,
    setDates,
    availability: fetcher.data,
    isChecking: fetcher.state === 'loading',
    createBooking,
    checkAvailability
  };
}
```

### ❌ DON'T: Fetch Data in useEffect

```typescript
// Bad: Client-side fetching with useEffect
function BadListingDetail() {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/listings/${id}`)
      .then(res => res.json())
      .then(data => setListing(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading...</div>;
  // ...
}

// Good: Use loader instead (shown above)
```

### ✅ DO: Implement Optimistic UI

```typescript
import { useFetcher, useLoaderData } from 'react-router';

export function ReviewsList() {
  const { reviews } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  // Optimistic review while submission in progress
  const optimisticReviews = fetcher.formData
    ? [
        {
          id: 'temp-' + Date.now(),
          rating: parseInt(fetcher.formData.get('rating') as string),
          comment: fetcher.formData.get('comment') as string,
          createdAt: new Date(),
          renter: { firstName: 'You' }
        },
        ...reviews
      ]
    : reviews;

  return (
    <div>
      <fetcher.Form method="post" action="/reviews">
        <select name="rating" required>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
        <textarea name="comment" required placeholder="Share your experience" />
        <button type="submit">Submit Review</button>
      </fetcher.Form>

      <div className="mt-6 space-y-4">
        {optimisticReviews.map(review => (
          <ReviewCard
            key={review.id}
            review={review}
            isPending={review.id.startsWith('temp-')}
          />
        ))}
      </div>
    </div>
  );
}
```

### ✅ DO: Handle Errors Gracefully

```typescript
// routes/listings.$id.tsx
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-4xl font-bold">Listing Not Found</h1>
          <p className="mt-4 text-gray-600">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/search" className="mt-6 inline-block text-blue-600">
            Browse all listings →
          </Link>
        </div>
      );
    }

    if (error.status === 500) {
      return (
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="mt-4 text-gray-600">
            We're having trouble loading this listing. Please try again later.
          </p>
        </div>
      );
    }
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <h1 className="text-4xl font-bold">Unexpected Error</h1>
      <p className="mt-4 text-gray-600">
        {error instanceof Error ? error.message : 'An unknown error occurred'}
      </p>
    </div>
  );
}
```

### ✅ DO: Memoize Expensive Computations

```typescript
import { useMemo, useCallback } from 'react';

function BookingCalculator({ listing, startDate, endDate }: Props) {
  // Memoize expensive calculations
  const pricing = useMemo(() => {
    if (!startDate || !endDate) return null;

    const days = differenceInDays(endDate, startDate);
    const basePrice = listing.basePrice * days;
    const serviceFee = basePrice * 0.1;
    const tax = basePrice * 0.08;
    const total = basePrice + serviceFee + tax;

    return { days, basePrice, serviceFee, tax, total };
  }, [listing.basePrice, startDate, endDate]);

  // Memoize callbacks passed to children
  const handleDateChange = useCallback((start: Date, end: Date) => {
    // Handle date change
  }, []);

  return (
    <div>
      {pricing && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>${listing.basePrice} × {pricing.days} days</span>
            <span>${pricing.basePrice}</span>
          </div>
          <div className="flex justify-between">
            <span>Service fee</span>
            <span>${pricing.serviceFee}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>${pricing.tax}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total</span>
            <span>${pricing.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. React Native & Expo

### ✅ DO: Use Expo Router for Type-Safe Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280'
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined
        }}
      />
    </Tabs>
  );
}

// app/listings/[id].tsx
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);

  const handleBook = () => {
    router.push({
      pathname: '/booking/[id]',
      params: { id: listing.id }
    });
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <Image
        source={{ uri: listing.photos[0]?.url }}
        className="w-full h-64"
        resizeMode="cover"
      />
      <View className="p-4">
        <Text className="text-2xl font-bold">{listing.title}</Text>
        <Text className="text-gray-600 mt-2">{listing.description}</Text>
        
        <Pressable
          onPress={handleBook}
          className="mt-6 bg-blue-600 py-3 rounded-lg active:bg-blue-700"
        >
          <Text className="text-white text-center font-semibold">
            Book Now
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

### ✅ DO: Use FlatList for Long Lists

```typescript
import { FlatList, View, Text, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';

function ListingsList() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey: ['listings'],
    queryFn: ({ pageParam = 0 }) => fetchListings(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });

  const listings = data?.pages.flatMap(page => page.items) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(({ item }: { item: Listing }) => (
    <ListingCard listing={item} />
  ), []);

  const renderFooter = () => {
    if (!hasNextPage) return null;
    return (
      <View className="py-4">
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <FlatList
      data={listings}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerClassName="p-4"
      ItemSeparatorComponent={() => <View className="h-4" />}
      ListEmptyComponent={() => (
        <View className="py-12 items-center">
          <Text className="text-gray-600">No listings found</Text>
        </View>
      )}
      ListFooterComponent={renderFooter}
      onEndReached={() => {
        if (hasNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={21}
    />
  );
}
```

### ✅ DO: Handle Keyboard Properly

```typescript
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

function MessageInput() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        {/* Your content */}
      </ScrollView>
      
      <View className="border-t border-gray-200 p-4">
        <TextInput
          placeholder="Type a message..."
          className="border border-gray-300 rounded-full px-4 py-2"
          multiline
          maxLength={500}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
```

### ✅ DO: Implement Push Notifications

```typescript
// services/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id'
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    });
  }

  return token.data;
}

// app/_layout.tsx
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';

export default function RootLayout() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for notifications
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        // Send token to your backend
        api.updatePushToken(token);
      }
    });

    // Handle notification received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('Notification received:', notification);
      }
    );

    // Handle notification tapped
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        
        // Navigate based on notification type
        if (data.type === 'new_message') {
          router.push(`/messages/${data.conversationId}`);
        } else if (data.type === 'booking_confirmed') {
          router.push(`/trips/${data.bookingId}`);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return <Slot />;
}
```

### ✅ DO: Handle Images Efficiently

```typescript
import { Image } from 'expo-image';

function ListingImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash} // Use blurhash for smooth loading
      contentFit="cover"
      transition={200}
      className="w-full h-48"
      cachePolicy="memory-disk" // Cache images
      onError={(error) => {
        console.error('Image load error:', error);
      }}
    />
  );
}

// For user avatars with fallback
function Avatar({ uri, name }: { uri?: string; name: string }) {
  return uri ? (
    <Image
      source={{ uri }}
      className="w-10 h-10 rounded-full"
      cachePolicy="memory-disk"
    />
  ) : (
    <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center">
      <Text className="text-white font-semibold">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
```

### ❌ DON'T: Use Inline Functions in Render

```typescript
// Bad: Creates new function on every render
function BadComponent({ items }: Props) {
  return (
    <FlatList
      data={items}
      renderItem={({ item }) => <ItemCard item={item} onPress={() => handlePress(item)} />}
    />
  );
}

// Good: Use useCallback
function GoodComponent({ items }: Props) {
  const handlePress = useCallback((item: Item) => {
    // Handle press
  }, []);

  const renderItem = useCallback(({ item }: { item: Item }) => (
    <ItemCard item={item} onPress={() => handlePress(item)} />
  ), [handlePress]);

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
}
```

---

## 4. TailwindCSS

### ✅ DO: Use Semantic Class Names

```typescript
// tailwind.config.js - Extend with project-specific utilities
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        secondary: {
          500: '#6b7280',
          600: '#4b5563'
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
};

// Use extended classes
function Button({ variant = 'primary', children }: Props) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-md font-semibold transition-colors',
        variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700',
        variant === 'secondary' && 'bg-secondary-500 text-white hover:bg-secondary-600',
        variant === 'outline' && 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50'
      )}
    >
      {children}
    </button>
  );
}
```

### ✅ DO: Create Reusable Component Variants

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700',
        secondary: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200',
        outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
        ghost: 'hover:bg-gray-100 text-gray-700',
        link: 'underline-offset-4 hover:underline text-primary-600'
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-lg',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || disabled}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
```

### ✅ DO: Use Container Queries for Responsive Components

```typescript
// Layout component with container queries
function DashboardCard({ children }: Props) {
  return (
    <div className="@container">
      <div className="bg-white rounded-lg shadow p-4 @md:p-6 @lg:p-8">
        {children}
      </div>
    </div>
  );
}

// Content adapts based on container size, not viewport
function CardContent() {
  return (
    <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
      <StatItem label="Revenue" value="$12,345" />
      <StatItem label="Bookings" value="156" />
      <StatItem label="Users" value="1,234" />
    </div>
  );
}
```

### ✅ DO: Optimize for Dark Mode

```typescript
function Card({ children }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-gray-900 dark:text-gray-100 font-bold">
        Trending Listings
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        {children}
      </p>
    </div>
  );
}

// Toggle dark mode
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### ❌ DON'T: Use Arbitrary Values Everywhere

```typescript
// Bad: Hard to maintain, not part of design system
<div className="mt-[13px] px-[22px] text-[17px]">

// Good: Use design tokens
<div className="mt-3 px-6 text-lg">

// If you need custom values frequently, add them to config
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      spacing: {
        '22': '5.5rem'
      },
      fontSize: {
        '2xs': '0.625rem'
      }
    }
  }
};
```

### ✅ DO: Use @apply for Complex Components

```css
/* components.css - Use @apply sparingly for truly reusable patterns */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-600 text-white rounded-md font-semibold;
    @apply hover:bg-primary-700 active:bg-primary-800;
    @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply transition-colors duration-200;
  }

  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-md;
    @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent;
    @apply disabled:bg-gray-100 disabled:cursor-not-allowed;
  }

  .card {
    @apply bg-white rounded-lg shadow-md p-6;
    @apply dark:bg-gray-800;
  }
}
```

---

## 5. NestJS Backend Patterns

### ✅ DO: Use Dependency Injection Properly

```typescript
// modules/booking/booking.module.ts
import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingStateMachine } from './booking-state-machine';
import { AvailabilityService } from './availability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, PaymentModule, NotificationModule],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingStateMachine,
    AvailabilityService
  ],
  exports: [BookingService] // Export for use in other modules
})
export class BookingModule {}

// booking.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateMachine } from './booking-state-machine';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachine,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService
  ) {}

  async createBooking(createBookingDto: CreateBookingDto, userId: string) {
    // Validate listing exists
    const listing = await this.prisma.listing.findUnique({
      where: { id: createBookingDto.listingId },
      include: { owner: true }
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId === userId) {
      throw new BadRequestException('Cannot book your own listing');
    }

    // Use transaction for atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Create booking in DRAFT state
      const booking = await tx.booking.create({
        data: {
          listingId: createBookingDto.listingId,
          renterId: userId,
          startDate: createBookingDto.startDate,
          endDate: createBookingDto.endDate,
          guests: createBookingDto.guests,
          status: 'DRAFT',
          totalAmount: calculateTotalAmount(listing, createBookingDto)
        }
      });

      // Transition to PENDING_PAYMENT
      await this.stateMachine.transition(booking.id, 'PENDING_PAYMENT', tx);

      // Create payment intent
      const paymentIntent = await this.paymentService.createIntent({
        amount: booking.totalAmount,
        bookingId: booking.id,
        ownerId: listing.ownerId
      });

      // Update booking with payment info
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentIntentId: paymentIntent.id }
      });

      return { booking, paymentIntent };
    });
  }
}
```

### ✅ DO: Use Guards for Authorization

```typescript
// guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}

// guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Public = () => SetMetadata('isPublic', true);

// decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// Usage in controller
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('stats')
  @Roles('ADMIN')
  async getStats() {
    // Only accessible by admins
  }

  @Get('public-info')
  @Public()
  async getPublicInfo() {
    // Accessible without authentication
  }
}
```

### ✅ DO: Use Interceptors for Cross-Cutting Concerns

```typescript
// interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          console.log(`${method} ${url} - ${responseTime}ms`);
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          console.error(`${method} ${url} - ${responseTime}ms - Error: ${error.message}`);
        }
      })
    );
  }
}

// interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString()
      }))
    );
  }
}

// Apply globally in main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor()
  );
  await app.listen(3000);
}
```

### ✅ DO: Use Pipes for Validation

```typescript
// dto/create-booking.dto.ts
import { IsString, IsDateString, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'lst_123abc' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @ApiProperty({ example: '2026-06-05' })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  endDate: Date;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  guests: number;
}

// Custom validation pipe
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isAfter, isBefore, addDays } from 'date-fns';

@Injectable()
export class DateRangeValidationPipe implements PipeTransform {
  transform(value: CreateBookingDto) {
    const { startDate, endDate } = value;

    // Ensure start date is in the future
    if (isBefore(startDate, new Date())) {
      throw new BadRequestException('Start date must be in the future');
    }

    // Ensure end date is after start date
    if (!isAfter(endDate, startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    // Ensure booking is at least 1 day
    if (isBefore(endDate, addDays(startDate, 1))) {
      throw new BadRequestException('Booking must be at least 1 day');
    }

    return value;
  }
}

// Controller usage
@Post()
@UsePipes(ValidationPipe, DateRangeValidationPipe)
async createBooking(
  @Body() createBookingDto: CreateBookingDto,
  @CurrentUser() user: User
) {
  return this.bookingService.createBooking(createBookingDto, user.id);
}
```

### ✅ DO: Use Exception Filters

```typescript
// filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;
      code = (exceptionResponse as any).code || exception.name;
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Handle Prisma errors
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          code = 'DUPLICATE_ENTRY';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = 'NOT_FOUND';
          break;
        default:
          message = 'Database operation failed';
          code = 'DATABASE_ERROR';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    console.error('Exception occurred:', {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      exception: exception instanceof Error ? exception.stack : exception
    });

    response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}

// Apply globally
app.useGlobalFilters(new AllExceptionsFilter());
```

### ✅ DO: Use Configuration Module

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    platformFeePercent: parseInt(process.env.PLATFORM_FEE_PERCENT || '10', 10)
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    }
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
});

// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        STRIPE_SECRET_KEY: Joi.string().required()
      })
    })
  ]
})
export class AppModule {}

// Usage in service
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('stripe.secretKey'),
      { apiVersion: '2023-10-16' }
    );
  }
}
```

### ✅ DO: Implement Health Checks

```typescript
// health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import { ElasticsearchHealthIndicator } from './elasticsearch-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
    private elasticsearch: ElasticsearchHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.elasticsearch.isHealthy('elasticsearch'),
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024)
    ]);
  }
}

// prisma-health.indicator.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('Prisma check failed', this.getStatus(key, false));
    }
  }
}
```

---

## 6. Prisma ORM

### ✅ DO: Use Type-Safe Queries

```typescript
// Good: Type-safe queries with Prisma Client
async function getListingWithRelations(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          rating: true,
          verifiedOwner: true
        }
      },
      photos: {
        orderBy: { order: 'asc' }
      },
      reviews: {
        where: { status: 'APPROVED' },
        include: {
          renter: {
            select: { firstName: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      _count: {
        select: {
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
            }
          }
        }
      }
    }
  });

  return listing;
}

// TypeScript knows the exact shape of the result
// listing.owner.firstName ✅
// listing.owner.email ❌ (not selected)
```

### ✅ DO: Use Transactions for Atomicity

```typescript
import { Prisma } from '@prisma/client';

async function createBookingWithPayment(data: CreateBookingData) {
  return await prisma.$transaction(
    async (tx) => {
      // Create booking
      const booking = await tx.booking.create({
        data: {
          listingId: data.listingId,
          renterId: data.renterId,
          startDate: data.startDate,
          endDate: data.endDate,
          status: 'PENDING_PAYMENT',
          totalAmount: data.totalAmount
        }
      });

      // Create deposit hold
      const depositHold = await tx.depositHold.create({
        data: {
          bookingId: booking.id,
          amount: data.totalAmount,
          status: 'PENDING'
        }
      });

      // Create ledger entries (double-entry accounting)
      await tx.ledgerEntry.createMany({
        data: [
          {
            userId: data.renterId,
            type: 'DEBIT',
            amount: data.totalAmount,
            bookingId: booking.id,
            description: `Payment for booking ${booking.id}`
          },
          {
            userId: data.ownerId,
            type: 'CREDIT',
            amount: data.totalAmount * 0.9, // After platform fee
            bookingId: booking.id,
            description: `Payout for booking ${booking.id}`
          }
        ]
      });

      return { booking, depositHold };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000, // 5 seconds
      timeout: 10000 // 10 seconds
    }
  );
}
```

### ✅ DO: Optimize Queries with Select/Include

```typescript
// Bad: Fetches all fields including sensitive data
const users = await prisma.user.findMany();

// Good: Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatar: true,
    rating: true
    // Excludes: passwordHash, stripeCustomerId, etc.
  }
});

// Bad: N+1 query problem
const bookings = await prisma.booking.findMany();
for (const booking of bookings) {
  const listing = await prisma.listing.findUnique({
    where: { id: booking.listingId }
  });
  // Process listing...
}

// Good: Include relations in one query
const bookings = await prisma.booking.findMany({
  include: {
    listing: {
      include: {
        owner: {
          select: { firstName: true, avatar: true }
        }
      }
    },
    renter: {
      select: { firstName: true, avatar: true }
    }
  }
});
```

### ✅ DO: Use Pagination

```typescript
interface PaginationParams {
  page: number;
  limit: number;
}

async function getPaginatedListings({ page, limit }: PaginationParams) {
  const skip = (page - 1) * limit;

  const [listings, total] = await prisma.$transaction([
    prisma.listing.findMany({
      skip,
      take: limit,
      where: { status: 'ACTIVE' },
      include: {
        owner: {
          select: { firstName: true, avatar: true, rating: true }
        },
        photos: {
          take: 1,
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { verifiedOwner: 'desc' },
        { createdAt: 'desc' }
      ]
    }),
    prisma.listing.count({
      where: { status: 'ACTIVE' }
    })
  ]);

  return {
    data: listings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + listings.length < total
    }
  };
}

// Cursor-based pagination for infinite scroll
async function getCursorPaginatedListings(cursor?: string, limit: number = 20) {
  const listings = await prisma.listing.findMany({
    take: limit + 1, // Fetch one extra to check if there's more
    ...(cursor && {
      skip: 1, // Skip the cursor
      cursor: { id: cursor }
    }),
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });

  const hasMore = listings.length > limit;
  const results = hasMore ? listings.slice(0, -1) : listings;
  const nextCursor = hasMore ? results[results.length - 1].id : null;

  return {
    data: results,
    nextCursor,
    hasMore
  };
}
```

### ✅ DO: Use Prisma Middleware for Cross-Cutting Concerns

```typescript
// Add soft delete functionality
prisma.$use(async (params, next) => {
  if (params.model === 'User' || params.model === 'Listing') {
    if (params.action === 'delete') {
      // Change delete to update with deletedAt
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }
    
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
    }

    // Exclude soft-deleted records from queries
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst';
      params.args.where['deletedAt'] = null;
    }

    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }
  }

  return next(params);
});

// Logging middleware
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
  
  return result;
});
```

### ✅ DO: Handle Unique Constraints

```typescript
import { Prisma } from '@prisma/client';

async function createUser(data: CreateUserData) {
  try {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === 'P2002') {
        const field = (error.meta?.target as string[])?.[0];
        throw new ConflictException(`${field} already exists`);
      }
      
      // Foreign key constraint violation
      if (error.code === 'P2003') {
        throw new BadRequestException('Referenced record does not exist');
      }
      
      // Record not found
      if (error.code === 'P2025') {
        throw new NotFoundException('Record not found');
      }
    }
    
    throw error;
  }
}
```

### ✅ DO: Use Raw Queries When Needed

```typescript
// Complex aggregation query
async function getRevenueStats(startDate: Date, endDate: Date) {
  const result = await prisma.$queryRaw<RevenueStats[]>`
    SELECT
      DATE_TRUNC('day', b.created_at) as date,
      COUNT(DISTINCT b.id) as booking_count,
      SUM(b.total_amount) as total_revenue,
      AVG(b.total_amount) as avg_booking_value,
      COUNT(DISTINCT b.renter_id) as unique_renters
    FROM bookings b
    WHERE b.status IN ('CONFIRMED', 'COMPLETED')
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    GROUP BY DATE_TRUNC('day', b.created_at)
    ORDER BY date DESC
  `;

  return result;
}

// Full-text search (before Elasticsearch)
async function searchListings(query: string) {
  return await prisma.$queryRaw<Listing[]>`
    SELECT *
    FROM listings
    WHERE to_tsvector('english', title || ' ' || description)
      @@ plainto_tsquery('english', ${query})
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
    ORDER BY ts_rank(
      to_tsvector('english', title || ' ' || description),
      plainto_tsquery('english', ${query})
    ) DESC
    LIMIT 20
  `;
}
```

---

## 7. State Management (Zustand & Redux)

### ✅ DO: Use Zustand for Simple Client State (Web)

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'ADMIN' | 'OWNER' | 'RENTER';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        }))
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token
      })
    }
  )
);

// Usage in component
function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  
  const handleUpdateProfile = async (data: UpdateProfileData) => {
    const updated = await api.updateProfile(data);
    updateUser(updated);
  };

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <ProfileForm user={user} onSubmit={handleUpdateProfile} />
    </div>
  );
}

// Derived state
export const useIsOwner = () => useAuthStore((state) => state.user?.role === 'OWNER');
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === 'ADMIN');
```

### ✅ DO: Use Redux Toolkit for Complex State (Mobile)

```typescript
// store/slices/bookingSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

interface Booking {
  id: string;
  listingId: string;
  startDate: string;
  endDate: string;
  status: string;
  totalAmount: number;
}

interface BookingState {
  bookings: Booking[];
  currentBooking: Booking | null;
  loading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  bookings: [],
  currentBooking: null,
  loading: false,
  error: null
};

// Async thunks
export const fetchBookings = createAsyncThunk(
  'bookings/fetchBookings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getBookings();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch bookings');
    }
  }
);

export const createBooking = createAsyncThunk(
  'bookings/createBooking',
  async (data: CreateBookingData, { rejectWithValue }) => {
    try {
      const response = await api.createBooking(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create booking');
    }
  }
);

// Slice
const bookingSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setCurrentBooking: (state, action: PayloadAction<Booking>) => {
      state.currentBooking = action.payload;
    },
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
    updateBookingStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      const booking = state.bookings.find(b => b.id === action.payload.id);
      if (booking) {
        booking.status = action.payload.status;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch bookings
      .addCase(fetchBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create booking
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings.unshift(action.payload);
        state.currentBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setCurrentBooking, clearCurrentBooking, updateBookingStatus } = bookingSlice.actions;

// Selectors
export const selectAllBookings = (state: RootState) => state.bookings.bookings;
export const selectCurrentBooking = (state: RootState) => state.bookings.currentBooking;
export const selectUpcomingBookings = (state: RootState) =>
  state.bookings.bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'UPCOMING');
export const selectPastBookings = (state: RootState) =>
  state.bookings.bookings.filter(b => b.status === 'COMPLETED');

export default bookingSlice.reducer;

// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bookingReducer from './slices/bookingSlice';
import authReducer from './slices/authSlice';
import messageReducer from './slices/messageSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'bookings'] // Only persist these reducers
};

export const store = configureStore({
  reducer: {
    auth: persistReducer(persistConfig, authReducer),
    bookings: persistReducer(persistConfig, bookingReducer),
    messages: messageReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    })
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Usage in component
import { useAppDispatch, useAppSelector } from '../hooks/redux';

function TripsScreen() {
  const dispatch = useAppDispatch();
  const bookings = useAppSelector(selectUpcomingBookings);
  const loading = useAppSelector(state => state.bookings.loading);

  useEffect(() => {
    dispatch(fetchBookings());
  }, [dispatch]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <FlatList
      data={bookings}
      renderItem={({ item }) => <BookingCard booking={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

---

## 8. Socket.io Real-time

### ✅ DO: Implement Reconnection Logic

```typescript
// lib/socket.ts (Frontend)
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const token = useAuthStore.getState().token;
    
    if (!token) {
      console.error('No auth token available');
      return;
    }

    this.socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected, reconnect manually
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, queuing message');
      // Optionally queue messages
      return;
    }
    
    this.socket.emit(event, data);
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return;
    }
    
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
```

### ✅ DO: Use Rooms and Namespaces (Backend)

```typescript
// gateways/messaging.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  namespace: '/messages'
})
@UseGuards(WsJwtGuard)
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private messagingService: MessagingService,
    private cacheService: CacheService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      console.log(`Client connected: ${client.id}, User: ${client.userId}`);

      // Store user's socket ID in Redis for presence
      await this.cacheService.set(
        `user:${client.userId}:socket`,
        client.id,
        3600 // 1 hour TTL
      );

      // Join user's conversation rooms
      const conversations = await this.messagingService.getUserConversations(client.userId);
      
      for (const conversation of conversations) {
        client.join(`conversation:${conversation.id}`);
      }

      // Notify user's connections they're online
      this.server.emit('user:online', { userId: client.userId });
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    console.log(`Client disconnected: ${client.id}`);

    // Remove socket ID from Redis
    await this.cacheService.del(`user:${client.userId}:socket`);

    // Notify user's connections they're offline
    this.server.emit('user:offline', { userId: client.userId });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; text: string },
    @ConnectedSocket() client: AuthenticatedSocket,
    @CurrentUser() user: User
  ) {
    // Validate user is participant in conversation
    const isParticipant = await this.messagingService.isParticipant(
      data.conversationId,
      user.id
    );

    if (!isParticipant) {
      client.emit('error', { message: 'Not authorized for this conversation' });
      return;
    }

    // Check rate limit
    const rateKey = `rate:message:${user.id}`;
    const messageCount = await this.cacheService.incr(rateKey);
    
    if (messageCount === 1) {
      await this.cacheService.expire(rateKey, 60); // 1 minute window
    }
    
    if (messageCount > 10) {
      client.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    // Create message
    const message = await this.messagingService.createMessage({
      conversationId: data.conversationId,
      senderId: user.id,
      text: data.text
    });

    // Broadcast to conversation room
    this.server.to(`conversation:${data.conversationId}`).emit('message', {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt,
      sender: {
        firstName: user.firstName,
        avatar: user.avatar
      }
    });

    // Send push notification to offline users
    const participants = await this.messagingService.getConversationParticipants(
      data.conversationId
    );
    
    for (const participant of participants) {
      if (participant.id !== user.id) {
        const isOnline = await this.cacheService.exists(`user:${participant.id}:socket`);
        
        if (!isOnline) {
          await this.notificationService.sendPush(participant.id, {
            title: `New message from ${user.firstName}`,
            body: data.text,
            data: { conversationId: data.conversationId }
          });
        }
      }
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
    @CurrentUser() user: User
  ) {
    // Broadcast typing indicator to others in conversation
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId: user.id,
      isTyping: data.isTyping
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
    @CurrentUser() user: User
  ) {
    const readReceipt = await this.messagingService.markMessageAsRead(
      data.messageId,
      user.id
    );

    // Notify sender that message was read
    const message = await this.messagingService.getMessage(data.messageId);
    const senderSocketId = await this.cacheService.get(`user:${message.senderId}:socket`);
    
    if (senderSocketId) {
      this.server.to(senderSocketId).emit('messageRead', {
        messageId: data.messageId,
        readBy: user.id,
        readAt: readReceipt.readAt
      });
    }
  }
}
```

---

## 9. Testing Patterns

### ✅ DO: Write Unit Tests for Services

```typescript
// booking.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BookingService', () => {
  let service: BookingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    listing: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        }
      ]
    }).compile();

    service = module.get<BookingService>(BookingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    const mockListing = {
      id: 'listing-123',
      title: 'Test Listing',
      basePrice: 100,
      ownerId: 'owner-123',
      status: 'ACTIVE'
    };

    const createBookingDto = {
      listingId: 'listing-123',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-05'),
      guests: 2
    };

    it('should create a booking successfully', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-123',
        ...createBookingDto,
        renterId: 'renter-123',
        status: 'PENDING_PAYMENT',
        totalAmount: 400
      });

      const result = await service.createBooking(createBookingDto, 'renter-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-123');
      expect(mockPrismaService.listing.findUnique).toHaveBeenCalledWith({
        where: { id: 'listing-123' },
        include: { owner: true }
      });
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.createBooking(createBookingDto, 'renter-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user tries to book own listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(
        service.createBooking(createBookingDto, 'owner-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBooking', () => {
    it('should return a booking by id', async () => {
      const mockBooking = {
        id: 'booking-123',
        listingId: 'listing-123',
        renterId: 'renter-123',
        status: 'CONFIRMED'
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.getBooking('booking-123');

      expect(result).toEqual(mockBooking);
      expect(mockPrismaService.booking.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        include: expect.any(Object)
      });
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(service.getBooking('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
```

### ✅ DO: Write E2E Tests for API Endpoints

```typescript
// test/bookings.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let listingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean database
    await prisma.booking.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User'
      });

    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    // Create test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Listing',
        description: 'A test listing',
        categoryId: 'vehicles',
        basePrice: 100,
        location: {
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        }
      });

    listingId = listingResponse.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /bookings', () => {
    it('should create a booking', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          startDate: '2026-06-01',
          endDate: '2026-06-05',
          guests: 2
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING_PAYMENT');
      expect(response.body.listingId).toBe(listingId);
    });

    it('should return 400 for invalid dates', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          startDate: '2026-06-05',
          endDate: '2026-06-01', // End before start
          guests: 2
        })
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId,
          startDate: '2026-06-01',
          endDate: '2026-06-05',
          guests: 2
        })
        .expect(401);
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId: 'non-existent-id',
          startDate: '2026-06-01',
          endDate: '2026-06-05',
          guests: 2
        })
        .expect(404);
    });
  });

  describe('GET /bookings', () => {
    it('should return user bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings?status=PENDING_PAYMENT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.every((b: any) => b.status === 'PENDING_PAYMENT')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.limit).toBe(10);
    });
  });
});
```

### ✅ DO: Write React Component Tests

```typescript
// ListingCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListingCard } from './ListingCard';
import { BrowserRouter } from 'react-router-dom';

const mockListing = {
  id: 'listing-123',
  title: 'Acoustic Guitar',
  description: 'Beautiful acoustic guitar',
  basePrice: 45,
  photos: [{ url: 'https://example.com/photo.jpg' }],
  owner: {
    firstName: 'John',
    avatar: 'https://example.com/avatar.jpg',
    rating: 4.8
  },
  instantBookEnabled: true
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ListingCard', () => {
  it('renders listing information correctly', () => {
    renderWithRouter(<ListingCard listing={mockListing} />);

    expect(screen.getByText('Acoustic Guitar')).toBeInTheDocument();
    expect(screen.getByText('$45/day')).toBeInTheDocument();
    expect(screen.getByAlt('Acoustic Guitar')).toHaveAttribute(
      'src',
      mockListing.photos[0].url
    );
  });

  it('shows instant book badge when enabled', () => {
    renderWithRouter(<ListingCard listing={mockListing} />);

    expect(screen.getByText('Instant Book')).toBeInTheDocument();
  });

  it('does not show instant book badge when disabled', () => {
    const listingWithoutInstantBook = {
      ...mockListing,
      instantBookEnabled: false
    };

    renderWithRouter(<ListingCard listing={listingWithoutInstantBook} />);

    expect(screen.queryByText('Instant Book')).not.toBeInTheDocument();
  });

  it('navigates to listing detail when clicked', () => {
    renderWithRouter(<ListingCard listing={mockListing} />);

    const card = screen.getByRole('link');
    expect(card).toHaveAttribute('href', `/listings/${mockListing.id}`);
  });

  it('calls onFavorite when favorite button is clicked', async () => {
    const onFavorite = jest.fn();
    renderWithRouter(<ListingCard listing={mockListing} onFavorite={onFavorite} />);

    const favoriteButton = screen.getByLabelText('Add to favorites');
    fireEvent.click(favoriteButton);

    await waitFor(() => {
      expect(onFavorite).toHaveBeenCalledWith(mockListing.id);
    });
  });

  it('displays owner information', () => {
    renderWithRouter(<ListingCard listing={mockListing} />);

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });
});
```

---

## 10. Security Best Practices

### ✅ DO: Sanitize User Input

```typescript
// pipes/sanitize.pipe.ts
import { PipeTransform, Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: [], // Strip all HTML
        ALLOWED_ATTR: []
      });
    }

    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeObject(obj: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

// Usage
@Post('reviews')
async createReview(
  @Body(SanitizePipe) data: CreateReviewDto,
  @CurrentUser() user: User
) {
  return this.reviewService.create(data, user.id);
}
```

### ✅ DO: Implement Rate Limiting

```typescript
// guards/throttle.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Redis } from 'ioredis';

@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  constructor(private readonly redis: Redis) {
    super();
  }

  async handleRequest(context: ExecutionContext, limit: number, ttl: number): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(context, request.ip);

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, ttl);
    }

    if (current > limit) {
      throw new ThrottlerException('Rate limit exceeded');
    }

    return true;
  }

  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || 'anonymous';
    const route = request.route?.path || request.url;
    
    return `rate-limit:${userId}:${route}:${suffix}`;
  }
}

// Apply per-route limits
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle(5, 60) // 5 requests per minute
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @Throttle(3, 3600) // 3 requests per hour
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
```

### ✅ DO: Validate File Uploads

```typescript
// pipes/file-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Express } from 'express';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  private readonly maxSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size > this.maxSize) {
      throw new BadRequestException(`File size exceeds ${this.maxSize / 1024 / 1024}MB limit`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }

    // Additional magic byte validation
    const magicBytes = file.buffer.slice(0, 4).toString('hex');
    const isValidImage = this.validateMagicBytes(magicBytes, file.mimetype);

    if (!isValidImage) {
      throw new BadRequestException('File content does not match declared type');
    }

    return file;
  }

  private validateMagicBytes(magicBytes: string, mimeType: string): boolean {
    const signatures: Record<string, string[]> = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe8'],
      'image/png': ['89504e47'],
      'image/webp': ['52494646'] // First 4 bytes of RIFF
    };

    const validSignatures = signatures[mimeType] || [];
    return validSignatures.some(sig => magicBytes.startsWith(sig));
  }
}

// Controller usage
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadPhoto(
  @UploadedFile(ImageValidationPipe) file: Express.Multer.File,
  @CurrentUser() user: User
) {
  return this.photoService.upload(file, user.id);
}
```

### ✅ DO: Prevent SQL Injection with Parameterized Queries

```typescript
// Bad: String concatenation (vulnerable to SQL injection)
async function badSearch(query: string) {
  return await prisma.$queryRawUnsafe(
    `SELECT * FROM listings WHERE title LIKE '%${query}%'`
  );
}

// Good: Parameterized query
async function goodSearch(query: string) {
  return await prisma.$queryRaw`
    SELECT * FROM listings
    WHERE title LIKE ${'%' + query + '%'}
      AND status = 'ACTIVE'
  `;
}

// Even better: Use Prisma's type-safe query builder
async function bestSearch(query: string) {
  return await prisma.listing.findMany({
    where: {
      title: {
        contains: query,
        mode: 'insensitive'
      },
      status: 'ACTIVE'
    }
  });
}
```

### ✅ DO: Implement CSRF Protection

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import * as csurf from 'csurf';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with credentials
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust for production
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", process.env.API_URL],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // CSRF protection (exclude API endpoints using tokens)
  app.use(csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
  }));

  await app.listen(3000);
}
bootstrap();

// CSRF token endpoint
@Controller('auth')
export class AuthController {
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request) {
    return { csrfToken: req.csrfToken() };
  }
}
```

---

## 11. Performance Optimization

### ✅ DO: Implement Caching Strategies

```typescript
// services/cache.service.ts
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  constructor(private readonly redis: Redis) {}

  // Cache-aside pattern
  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = 3600): Promise<T> {
    // Try to get from cache
    const cached = await this.redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss - fetch from source
    const data = await fetcher();
    
    // Store in cache
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }

  // Write-through pattern
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  // Invalidate cache
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Invalidate by pattern
  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Usage in service
@Injectable()
export class ListingService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService
  ) {}

  async getListing(id: string) {
    return this.cache.get(
      `listing:${id}`,
      async () => {
        return this.prisma.listing.findUnique({
          where: { id },
          include: {
            owner: { select: { firstName: true, avatar: true, rating: true } },
            photos: true
          }
        });
      },
      3600 // 1 hour
    );
  }

  async updateListing(id: string, data: UpdateListingDto) {
    const updated = await this.prisma.listing.update({
      where: { id },
      data
    });

    // Invalidate cache
    await this.cache.del(`listing:${id}`);
    await this.cache.delByPattern(`listings:*`); // Invalidate list caches

    return updated;
  }
}
```

### ✅ DO: Optimize Database Queries

```typescript
// Bad: N+1 query problem
async function getBookingsWithListings() {
  const bookings = await prisma.booking.findMany();
  
  for (const booking of bookings) {
    booking.listing = await prisma.listing.findUnique({
      where: { id: booking.listingId }
    });
  }
  
  return bookings;
}

// Good: Use include to fetch relations
async function getBookingsWithListings() {
  return prisma.booking.findMany({
    include: {
      listing: {
        include: {
          owner: { select: { firstName: true, avatar: true } }
        }
      },
      renter: { select: { firstName: true, avatar: true } }
    }
  });
}

// Better: Use select to fetch only needed fields
async function getBookingsWithListingsOptimized() {
  return prisma.booking.findMany({
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      totalAmount: true,
      listing: {
        select: {
          id: true,
          title: true,
          basePrice: true,
          photos: {
            select: { url: true },
            take: 1
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              avatar: true
            }
          }
        }
      },
      renter: {
        select: {
          id: true,
          firstName: true,
          avatar: true
        }
      }
    }
  });
}
```

### ✅ DO: Implement Lazy Loading

```typescript
// React component with lazy loading
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy load route components
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/booking/:id" element={<BookingPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </Suspense>
  );
}

// Lazy load images with intersection observer
function LazyImage({ src, alt, className }: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
      {!isLoaded && <Skeleton className="w-full h-full" />}
    </div>
  );
}
```

### ✅ DO: Use Database Indexes

```prisma
// schema.prisma
model Listing {
  id          String   @id @default(cuid())
  title       String
  description String
  categoryId  String
  ownerId     String
  status      ListingStatus @default(DRAFT)
  basePrice   Float
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  owner       User     @relation(fields: [ownerId], references: [id])
  bookings    Booking[]

  // Indexes for frequently queried fields
  @@index([categoryId, status, deletedAt])
  @@index([ownerId, status])
  @@index([status, createdAt])
  @@index([basePrice, status])
  @@fulltext([title, description]) // Full-text search
}

model Booking {
  id         String   @id @default(cuid())
  listingId  String
  renterId   String
  status     BookingStatus
  startDate  DateTime
  endDate    DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  listing    Listing  @relation(fields: [listingId], references: [id])
  renter     User     @relation(fields: [renterId], references: [id])

  // Composite index for availability queries
  @@index([listingId, startDate, endDate, status])
  @@index([renterId, status])
  @@index([status, createdAt])
}
```

---

## 12. Error Handling

### ✅ DO: Use Custom Error Classes

```typescript
// errors/app.errors.ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} with id '${identifier}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

// Usage
async function getBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  
  if (!booking) {
    throw new NotFoundError('Booking', id);
  }
  
  return booking;
}

async function createUser(data: CreateUserDto) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email }
  });
  
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }
  
  return prisma.user.create({ data });
}
```

### ✅ DO: Implement Global Error Handler

```typescript
// Frontend error boundary
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to error tracking service
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Your routes */}
      </Routes>
    </ErrorBoundary>
  );
}
```

### ✅ DO: Handle Async Errors Properly

```typescript
// utils/async-handler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Controller with error handling
@Controller('bookings')
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: User
  ) {
    try {
      const booking = await this.bookingService.createBooking(createBookingDto, user.id);
      return booking;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ConflictError) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException('Failed to create booking');
    }
  }
}
```

---

## Quick Reference Checklist

### Before Every Code Change

- [ ] **TypeScript**: Are types explicit? No `any` usage?
- [ ] **Security**: Is user input validated and sanitized?
- [ ] **Performance**: Are queries optimized? Using proper indexes?
- [ ] **Error Handling**: Are errors caught and handled gracefully?
- [ ] **Testing**: Are new features covered by tests?
- [ ] **Accessibility**: Is the UI accessible (ARIA labels, keyboard nav)?
- [ ] **Mobile**: Does it work on mobile devices (React Native)?
- [ ] **Caching**: Can this data be cached? Is cache invalidated properly?

### Before Committing

- [ ] Run linter: `npm run lint`
- [ ] Run tests: `npm test`
- [ ] Run type check: `npm run type-check`
- [ ] Format code: `npm run format`
- [ ] Check bundle size: `npm run build`
- [ ] Review changes: Is anything unnecessarily included?

### Before Deploying

- [ ] All tests passing in CI/CD
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Cache cleared if needed
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented

---

This reference guide should be consulted whenever:
1. Implementing new features
2. Refactoring existing code
3. Reviewing pull requests
4. Debugging issues
5. Optimizing performance
6. Improving security

Keep this document updated as new patterns and best practices emerge!
