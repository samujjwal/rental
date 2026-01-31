# Post-MVP Implementation Roadmap
## Complete Feature Development Plan with Technical Specifications

**Platform**: Universal Rental Portal  
**Timeline**: 12 months post-MVP  
**Status**: Detailed Planning Document

---

## 📋 Table of Contents

1. [Mobile Application](#mobile-application)
2. [Advanced Analytics & BI](#advanced-analytics--bi)
3. [Machine Learning Features](#machine-learning-features)
4. [Internationalization](#internationalization)
5. [Performance Optimization](#performance-optimization)
6. [Enterprise Features](#enterprise-features)
7. [Platform Scaling](#platform-scaling)
8. [Security Enhancements](#security-enhancements)

---

## 📱 Mobile Application

### Phase 1: Foundation (Months 1-2)

#### Technical Stack:
```typescript
// Framework: React Native with Expo
// State Management: Redux Toolkit + RTK Query
// Navigation: React Navigation v6
// UI Components: React Native Paper + Custom Design System
// Push Notifications: Firebase Cloud Messaging
// Offline Storage: WatermelonDB + Redux Persist
// Camera: Expo Camera + Image Picker
// Maps: React Native Maps
// Analytics: Firebase Analytics + Sentry
```

#### Project Structure:
```
apps/mobile/
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── listings/
│   │   ├── bookings/
│   │   └── messaging/
│   ├── screens/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── listings/
│   │   ├── bookings/
│   │   ├── messages/
│   │   └── profile/
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainTabNavigator.tsx
│   ├── store/
│   │   ├── slices/
│   │   └── api/
│   ├── services/
│   │   ├── api.ts
│   │   ├── push-notifications.ts
│   │   ├── camera.ts
│   │   └── offline-sync.ts
│   ├── utils/
│   ├── hooks/
│   └── types/
├── assets/
│   ├── images/
│   ├── fonts/
│   └── animations/
├── app.json
├── package.json
└── tsconfig.json
```

#### Core Features Implementation:

**1. Authentication Flow**
```typescript
// apps/mobile/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useLoginMutation } from '../../store/api/authApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();

  const handleLogin = async () => {
    try {
      const result = await login({ email, password }).unwrap();
      await AsyncStorage.setItem('auth_token', result.access_token);
      await AsyncStorage.setItem('refresh_token', result.refresh_token);
      navigation.replace('Main');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.title}>
        Welcome Back
      </Text>
      
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      
      <Button
        mode="contained"
        onPress={handleLogin}
        loading={isLoading}
        disabled={isLoading}
        style={styles.button}
      >
        Sign In
      </Button>
      
      {error && (
        <Text style={styles.error}>
          {error.data?.message || 'Login failed'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  error: {
    color: 'red',
    marginTop: 16,
    textAlign: 'center',
  },
});
```

**2. Camera Integration for Condition Reports**
```typescript
// apps/mobile/src/services/camera.ts
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export class CameraService {
  static async requestPermissions() {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return {
      camera: cameraPermission.status === 'granted',
      media: mediaPermission.status === 'granted',
    };
  }

  static async takePicture(camera: Camera) {
    const photo = await camera.takePictureAsync({
      quality: 0.8,
      base64: false,
      exif: true,
    });
    
    return photo;
  }

  static async pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      return result.assets[0];
    }
    
    return null;
  }

  static async compressAndUpload(uri: string, apiClient: any) {
    // Compress image
    const compressedUri = await this.compressImage(uri);
    
    // Upload to API
    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    
    return await apiClient.uploadPhoto(formData);
  }

  private static async compressImage(uri: string): Promise<string> {
    // Implementation using expo-image-manipulator
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    
    return manipulated.uri;
  }
}
```

**3. Offline Sync Implementation**
```typescript
// apps/mobile/src/services/offline-sync.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

const OFFLINE_QUEUE_KEY = 'offline_actions_queue';

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  data: any;
  timestamp: number;
}

export class OfflineSyncService {
  private database: Database;
  private isOnline: boolean = true;

  constructor(database: Database) {
    this.database = database;
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline) {
        this.syncOfflineActions();
      }
    });
  }

  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp'>) {
    const queue = await this.getQueue();
    const newAction: OfflineAction = {
      ...action,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    };
    
    queue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    if (this.isOnline) {
      await this.syncOfflineActions();
    }
  }

  private async getQueue(): Promise<OfflineAction[]> {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  }

  private async syncOfflineActions() {
    const queue = await this.getQueue();
    
    if (queue.length === 0) return;
    
    const successfullyProcessed: string[] = [];
    
    for (const action of queue) {
      try {
        await this.processAction(action);
        successfullyProcessed.push(action.id);
      } catch (error) {
        console.error('Failed to process action:', action, error);
        // Keep failed actions in queue
      }
    }
    
    // Remove successfully processed actions
    const remaining = queue.filter(a => !successfullyProcessed.includes(a.id));
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  }

  private async processAction(action: OfflineAction) {
    // Implement API calls based on action type and entity
    switch (action.entity) {
      case 'booking':
        return await this.syncBooking(action);
      case 'message':
        return await this.syncMessage(action);
      case 'listing':
        return await this.syncListing(action);
      default:
        throw new Error(`Unknown entity type: ${action.entity}`);
    }
  }

  private async syncBooking(action: OfflineAction) {
    // Implementation
  }

  private async syncMessage(action: OfflineAction) {
    // Implementation
  }

  private async syncListing(action: OfflineAction) {
    // Implementation
  }
}
```

**4. Push Notifications**
```typescript
// apps/mobile/src/services/push-notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  static async registerForPushNotifications(): Promise<string | null> {
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

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }

  static setupNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationTapped: (response: Notifications.NotificationResponse) => void
  ) {
    const receivedListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

    return () => {
      Notifications.removeNotificationSubscription(receivedListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  static async scheduleLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Immediate
    });
  }

  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  static async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
}
```

### Deliverables:
- [ ] iOS app (App Store)
- [ ] Android app (Play Store)
- [ ] Offline mode support
- [ ] Push notifications
- [ ] Camera integration
- [ ] Native performance

**Estimated Timeline**: 8 weeks  
**Team Size**: 2 mobile developers

---

## 📊 Advanced Analytics & BI

### Phase 2: Business Intelligence (Months 3-4)

#### Architecture:
```
Backend: Data Pipeline
┌─────────────┐
│ PostgreSQL  │
│  (Primary)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│   AWS DMS   │─────▶│  Redshift    │
│ (CDC Sync)  │      │ (Analytics)  │
└─────────────┘      └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Metabase   │
                     │  (Dashboard) │
                     └──────────────┘
```

#### Data Warehouse Schema:
```sql
-- Dimension Tables
CREATE TABLE dim_users (
  user_key SERIAL PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  user_type VARCHAR(20), -- RENTER, OWNER, BOTH
  registration_date DATE,
  country VARCHAR(50),
  city VARCHAR(100),
  is_verified BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE dim_listings (
  listing_key SERIAL PRIMARY KEY,
  listing_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  base_price DECIMAL(10,2),
  currency VARCHAR(10),
  country VARCHAR(50),
  city VARCHAR(100),
  created_date DATE,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE dim_categories (
  category_key SERIAL PRIMARY KEY,
  category_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),
  parent_category VARCHAR(200),
  level INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE dim_date (
  date_key INTEGER PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  year INTEGER,
  quarter INTEGER,
  month INTEGER,
  month_name VARCHAR(20),
  week INTEGER,
  day_of_month INTEGER,
  day_of_week INTEGER,
  day_name VARCHAR(20),
  is_weekend BOOLEAN,
  is_holiday BOOLEAN
);

-- Fact Tables
CREATE TABLE fact_bookings (
  booking_key SERIAL PRIMARY KEY,
  booking_id VARCHAR(50) UNIQUE NOT NULL,
  renter_key INTEGER REFERENCES dim_users(user_key),
  owner_key INTEGER REFERENCES dim_users(user_key),
  listing_key INTEGER REFERENCES dim_listings(listing_key),
  booking_date_key INTEGER REFERENCES dim_date(date_key),
  start_date_key INTEGER REFERENCES dim_date(date_key),
  end_date_key INTEGER REFERENCES dim_date(date_key),
  
  -- Measures
  base_price DECIMAL(10,2),
  service_fee DECIMAL(10,2),
  tax DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  total_price DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  owner_earnings DECIMAL(10,2),
  
  -- Dimensions
  status VARCHAR(50),
  duration_hours INTEGER,
  currency VARCHAR(10),
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE fact_payments (
  payment_key SERIAL PRIMARY KEY,
  payment_id VARCHAR(50) UNIQUE NOT NULL,
  booking_key INTEGER REFERENCES fact_bookings(booking_key),
  user_key INTEGER REFERENCES dim_users(user_key),
  payment_date_key INTEGER REFERENCES dim_date(date_key),
  
  -- Measures
  amount DECIMAL(10,2),
  fee DECIMAL(10,2),
  net_amount DECIMAL(10,2),
  
  -- Dimensions
  payment_method VARCHAR(50),
  status VARCHAR(50),
  currency VARCHAR(10),
  
  created_at TIMESTAMP
);

CREATE TABLE fact_reviews (
  review_key SERIAL PRIMARY KEY,
  review_id VARCHAR(50) UNIQUE NOT NULL,
  booking_key INTEGER REFERENCES fact_bookings(booking_key),
  reviewer_key INTEGER REFERENCES dim_users(user_key),
  reviewee_key INTEGER REFERENCES dim_users(user_key),
  listing_key INTEGER REFERENCES dim_listings(listing_key),
  review_date_key INTEGER REFERENCES dim_date(date_key),
  
  -- Measures
  rating DECIMAL(3,2),
  
  -- Dimensions
  review_type VARCHAR(50),
  sentiment VARCHAR(20), -- POSITIVE, NEUTRAL, NEGATIVE
  
  created_at TIMESTAMP
);

-- Aggregate Tables (for performance)
CREATE MATERIALIZED VIEW mv_daily_metrics AS
SELECT
  d.date,
  COUNT(DISTINCT b.booking_id) as total_bookings,
  SUM(b.total_price) as total_revenue,
  SUM(b.platform_fee) as platform_revenue,
  AVG(b.total_price) as avg_booking_value,
  COUNT(DISTINCT b.renter_key) as active_renters,
  COUNT(DISTINCT b.owner_key) as active_owners
FROM fact_bookings b
JOIN dim_date d ON b.booking_date_key = d.date_key
GROUP BY d.date;

CREATE INDEX idx_daily_metrics_date ON mv_daily_metrics(date);

-- Refresh materialized views nightly
CREATE OR REFRESH MATERIALIZED VIEW mv_daily_metrics;
```

#### Analytics API Endpoints:
```typescript
// apps/api/src/modules/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles('ADMIN')
  async getDashboardMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getDashboardMetrics(startDate, endDate);
  }

  @Get('revenue')
  @Roles('ADMIN', 'FINANCE')
  async getRevenueAnalytics(
    @Query('period') period: 'day' | 'week' | 'month' | 'year',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getRevenueAnalytics(period, startDate, endDate);
  }

  @Get('user-growth')
  @Roles('ADMIN')
  async getUserGrowth(
    @Query('period') period: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getUserGrowth(period);
  }

  @Get('listing-performance')
  @Roles('ADMIN', 'OWNER')
  async getListingPerformance(
    @Query('listingId') listingId?: string,
  ) {
    return this.analyticsService.getListingPerformance(listingId);
  }

  @Get('category-insights')
  @Roles('ADMIN')
  async getCategoryInsights() {
    return this.analyticsService.getCategoryInsights();
  }

  @Get('cohort-analysis')
  @Roles('ADMIN', 'ANALYTICS')
  async getCohortAnalysis(
    @Query('cohortType') cohortType: 'registration' | 'first_booking',
  ) {
    return this.analyticsService.getCohortAnalysis(cohortType);
  }

  @Get('funnel-analysis')
  @Roles('ADMIN', 'MARKETING')
  async getFunnelAnalysis() {
    return this.analyticsService.getFunnelAnalysis();
  }
}
```

#### Metabase Dashboards:
1. **Executive Dashboard**
   - Total Revenue (MTD, YTD)
   - Active Users (DAU, MAU)
   - Booking Conversion Rate
   - Average Order Value
   - Platform Gross Margin

2. **Operations Dashboard**
   - Pending Approvals
   - Active Disputes
   - Fulfillment Status
   - Customer Support Metrics
   - System Health

3. **Marketing Dashboard**
   - User Acquisition Funnel
   - CAC (Customer Acquisition Cost)
   - LTV (Lifetime Value)
   - Cohort Retention
   - Channel Performance

4. **Owner Performance Dashboard**
   - Listing Views
   - Booking Rate
   - Revenue per Listing
   - Occupancy Rate
   - Average Rating

### Deliverables:
- [ ] Redshift data warehouse
- [ ] ETL pipeline
- [ ] Metabase dashboards
- [ ] Real-time metrics API
- [ ] Custom report builder
- [ ] Automated insights

**Estimated Timeline**: 6 weeks  
**Team Size**: 1 data engineer, 1 analyst

---

## 🤖 Machine Learning Features

### Phase 3: AI/ML Integration (Months 5-7)

#### ML Pipeline Architecture:
```
┌──────────────┐
│   Training   │
│   Pipeline   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   S3/MLflow  │────▶│  SageMaker   │
│   (Models)   │     │  (Training)  │
└──────────────┘     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Lambda/ECS  │
                     │  (Inference) │
                     └──────────────┘
```

#### 1. Fraud Detection Model
```python
# ml/fraud_detection/model.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib

class FraudDetectionModel:
    def __init__(self):
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_names = [
            'account_age_days',
            'total_bookings',
            'cancelled_bookings_ratio',
            'avg_booking_value',
            'rapid_bookings_count',
            'unusual_hours_bookings',
            'payment_methods_count',
            'failed_payments_ratio',
            'price_deviation_score',
            'negative_reviews_ratio',
            'days_until_rental',
            'is_new_listing',
            'listing_price_vs_avg',
        ]
    
    def prepare_features(self, data):
        """Prepare features for model input"""
        features = pd.DataFrame()
        
        # User features
        features['account_age_days'] = (pd.Timestamp.now() - data['user_created_at']).dt.days
        features['total_bookings'] = data['user_total_bookings']
        features['cancelled_bookings_ratio'] = (
            data['user_cancelled_bookings'] / (data['user_total_bookings'] + 1)
        )
        features['avg_booking_value'] = data['user_avg_booking_value']
        
        # Booking pattern features
        features['rapid_bookings_count'] = data['recent_bookings_24h']
        features['unusual_hours_bookings'] = data['bookings_late_night_count']
        
        # Payment features
        features['payment_methods_count'] = data['user_payment_methods_count']
        features['failed_payments_ratio'] = (
            data['user_failed_payments'] / (data['user_total_payments'] + 1)
        )
        
        # Listing features
        features['price_deviation_score'] = np.abs(
            (data['listing_price'] - data['category_avg_price']) / data['category_avg_price']
        )
        features['is_new_listing'] = (
            pd.Timestamp.now() - data['listing_created_at']
        ).dt.days < 30
        features['listing_price_vs_avg'] = (
            data['listing_price'] / data['category_avg_price']
        )
        
        # Review features
        features['negative_reviews_ratio'] = (
            data['user_reviews_negative'] / (data['user_reviews_total'] + 1)
        )
        
        # Booking timing
        features['days_until_rental'] = (
            data['booking_start_date'] - pd.Timestamp.now()
        ).dt.days
        
        return features[self.feature_names]
    
    def train(self, X_train, y_train):
        """Train the fraud detection model"""
        X_scaled = self.scaler.fit_transform(X_train)
        self.model.fit(X_scaled, y_train)
        
        return {
            'train_accuracy': self.model.score(X_scaled, y_train),
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_
            ))
        }
    
    def predict_fraud_probability(self, features):
        """Predict fraud probability for a booking"""
        X_scaled = self.scaler.transform(features)
        probability = self.model.predict_proba(X_scaled)[:, 1]
        
        return {
            'fraud_probability': float(probability[0]),
            'risk_level': self._get_risk_level(probability[0]),
            'top_risk_factors': self._get_top_risk_factors(features.iloc[0])
        }
    
    def _get_risk_level(self, probability):
        if probability >= 0.8:
            return 'CRITICAL'
        elif probability >= 0.6:
            return 'HIGH'
        elif probability >= 0.4:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _get_top_risk_factors(self, feature_values):
        """Identify top contributing factors to fraud score"""
        importances = self.model.feature_importances_
        contributions = feature_values * importances
        
        top_indices = np.argsort(contributions)[-3:]
        
        return [
            {
                'feature': self.feature_names[i],
                'value': float(feature_values[i]),
                'contribution': float(contributions[i])
            }
            for i in top_indices
        ]
    
    def save(self, path):
        """Save model and scaler"""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }, path)
    
    @classmethod
    def load(cls, path):
        """Load model and scaler"""
        instance = cls()
        data = joblib.load(path)
        instance.model = data['model']
        instance.scaler = data['scaler']
        instance.feature_names = data['feature_names']
        return instance
```

#### 2. Recommendation System
```python
# ml/recommendations/collaborative_filtering.py
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.neighbors import NearestNeighbors

class CollaborativeRecommendationEngine:
    def __init__(self, n_recommendations=10):
        self.n_recommendations = n_recommendations
        self.model = NearestNeighbors(metric='cosine', algorithm='brute')
        self.user_item_matrix = None
        self.item_ids = []
        self.user_ids = []
    
    def fit(self, interactions_df):
        """
        Train model on user-listing interactions
        interactions_df: DataFrame with columns ['user_id', 'listing_id', 'interaction_weight']
        """
        # Create user-item matrix
        pivot = interactions_df.pivot(
            index='user_id',
            columns='listing_id',
            values='interaction_weight'
        ).fillna(0)
        
        self.user_ids = pivot.index.tolist()
        self.item_ids = pivot.columns.tolist()
        self.user_item_matrix = csr_matrix(pivot.values)
        
        # Fit KNN model
        self.model.fit(self.user_item_matrix)
    
    def recommend_for_user(self, user_id, exclude_interacted=True):
        """Get listing recommendations for a user"""
        if user_id not in self.user_ids:
            return self._recommend_popular()
        
        user_idx = self.user_ids.index(user_id)
        user_vector = self.user_item_matrix[user_idx]
        
        # Find similar users
        distances, indices = self.model.kneighbors(
            user_vector,
            n_neighbors=min(20, len(self.user_ids))
        )
        
        # Aggregate items from similar users
        similar_users_items = self.user_item_matrix[indices.flatten()].toarray()
        weighted_sum = np.sum(
            similar_users_items * (1 - distances).reshape(-1, 1),
            axis=0
        )
        
        # Exclude already interacted items
        if exclude_interacted:
            interacted = user_vector.toarray().flatten() > 0
            weighted_sum[interacted] = -np.inf
        
        # Get top N recommendations
        top_indices = np.argsort(weighted_sum)[-self.n_recommendations:][::-1]
        
        return [
            {
                'listing_id': self.item_ids[idx],
                'score': float(weighted_sum[idx])
            }
            for idx in top_indices
        ]
    
    def _recommend_popular(self):
        """Fallback to popular items for cold start"""
        popularity = np.asarray(self.user_item_matrix.sum(axis=0)).flatten()
        top_indices = np.argsort(popularity)[-self.n_recommendations:][::-1]
        
        return [
            {
                'listing_id': self.item_ids[idx],
                'score': float(popularity[idx])
            }
            for idx in top_indices
        ]
```

#### 3. Dynamic Pricing Model
```python
# ml/pricing/dynamic_pricing.py
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
import pandas as pd

class DynamicPricingModel:
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            random_state=42
        )
        self.feature_names = [
            'base_price',
            'season',
            'day_of_week',
            'days_until_rental',
            'demand_score',
            'supply_score',
            'listing_rating',
            'owner_response_rate',
            'rental_duration_days',
            'category_popularity',
            'location_demand',
            'competitor_avg_price',
        ]
    
    def prepare_features(self, data):
        """Prepare features for price prediction"""
        features = pd.DataFrame()
        
        # Base listing features
        features['base_price'] = data['listing_base_price']
        features['listing_rating'] = data['listing_avg_rating'].fillna(0)
        features['owner_response_rate'] = data['owner_response_rate'].fillna(0)
        
        # Temporal features
        features['season'] = pd.to_datetime(data['rental_date']).dt.month.map(
            lambda m: 1 if m in [12, 1, 2] else (2 if m in [3, 4, 5] else (3 if m in [6, 7, 8] else 4))
        )
        features['day_of_week'] = pd.to_datetime(data['rental_date']).dt.dayofweek
        features['days_until_rental'] = (
            pd.to_datetime(data['rental_date']) - pd.Timestamp.now()
        ).dt.days
        
        # Booking features
        features['rental_duration_days'] = data['rental_duration_days']
        
        # Market features
        features['demand_score'] = data['recent_searches_count'] / (
            data['available_listings_count'] + 1
        )
        features['supply_score'] = 1 / (data['available_listings_count'] + 1)
        features['category_popularity'] = data['category_booking_count_30d']
        features['location_demand'] = data['location_booking_count_30d']
        features['competitor_avg_price'] = data['similar_listings_avg_price']
        
        return features[self.feature_names]
    
    def train(self, X_train, y_train):
        """Train the pricing model"""
        self.model.fit(X_train, y_train)
        
        return {
            'train_r2': self.model.score(X_train, y_train),
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_
            ))
        }
    
    def suggest_optimal_price(self, features):
        """Suggest optimal price for a listing"""
        predicted_price = self.model.predict(features)[0]
        
        # Apply business rules
        base_price = features['base_price'].iloc[0]
        min_price = base_price * 0.7  # Don't go below 70% of base
        max_price = base_price * 2.0  # Don't go above 200% of base
        
        optimal_price = np.clip(predicted_price, min_price, max_price)
        
        return {
            'suggested_price': float(optimal_price),
            'base_price': float(base_price),
            'min_price': float(min_price),
            'max_price': float(max_price),
            'price_change_percent': float((optimal_price - base_price) / base_price * 100),
            'confidence': self._calculate_confidence(features)
        }
    
    def _calculate_confidence(self, features):
        """Calculate confidence in price suggestion"""
        # Use ensemble prediction variance as confidence metric
        predictions = [
            estimator.predict(features)[0]
            for estimator in self.model.estimators_.flatten()
        ]
        variance = np.var(predictions)
        confidence = 1 / (1 + variance / 100)  # Normalize to 0-1
        
        return float(confidence)
```

### Deliverables:
- [ ] Fraud detection API
- [ ] Recommendation engine
- [ ] Dynamic pricing
- [ ] Image classification
- [ ] Sentiment analysis
- [ ] Search ranking ML

**Estimated Timeline**: 12 weeks  
**Team Size**: 2 ML engineers, 1 data scientist

---

## 🌍 Internationalization

### Phase 4: Global Expansion (Months 8-9)

#### Implementation:
```typescript
// packages/i18n/src/index.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const supportedLanguages = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  zh: { name: 'Chinese', nativeName: '中文' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  ko: { name: 'Korean', nativeName: '한국어' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
};

i18next
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: Object.keys(supportedLanguages),
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: true,
    },
  });

export default i18next;
```

#### Currency Conversion:
```typescript
// apps/api/src/modules/currency/currency.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface ExchangeRates {
  [currency: string]: number;
}

@Injectable()
export class CurrencyService {
  private exchangeRates: ExchangeRates = {};
  private lastUpdate: Date | null = null;
  private readonly API_KEY: string;
  
  constructor(private configService: ConfigService) {
    this.API_KEY = this.configService.get('EXCHANGE_RATE_API_KEY') || '';
  }
  
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    
    await this.updateRatesIfNeeded();
    
    const rate = this.getConversionRate(from, to);
    return amount * rate;
  }
  
  private async updateRatesIfNeeded() {
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    
    if (!this.lastUpdate || now.getTime() - this.lastUpdate.getTime() > oneHour) {
      await this.fetchExchangeRates();
    }
  }
  
  private async fetchExchangeRates() {
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/USD`,
        { params: { apikey: this.API_KEY } }
      );
      
      this.exchangeRates = response.data.rates;
      this.lastUpdate = new Date();
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  }
  
  private getConversionRate(from: string, to: string): number {
    const fromRate = this.exchangeRates[from] || 1;
    const toRate = this.exchangeRates[to] || 1;
    return toRate / fromRate;
  }
}
```

### Deliverables:
- [ ] 10+ languages support
- [ ] Currency conversion
- [ ] Locale-specific formatting
- [ ] RTL support (Arabic)
- [ ] Translation management
- [ ] Regional compliance

**Estimated Timeline**: 8 weeks  
**Team Size**: 1 i18n engineer, translators

---

## 📈 Estimated Costs & ROI

### Development Costs:
| Phase | Duration | Team | Cost |
|-------|----------|------|------|
| Mobile App | 2 months | 2 devs | $40,000 |
| Analytics & BI | 1.5 months | 2 engineers | $30,000 |
| ML Features | 3 months | 3 engineers | $60,000 |
| i18n | 2 months | 1 dev + contractors | $20,000 |
| **Total** | **8-9 months** | **Varied** | **$150,000** |

### Infrastructure Costs (Monthly):
- AWS Services: $2,000 - $5,000
- ML Training: $1,000 - $3,000
- Translation Services: $500 - $1,000
- **Total**: $3,500 - $9,000/month

### Expected ROI:
- Mobile app: 40% increase in active users
- ML recommendations: 25% increase in booking conversion
- Dynamic pricing: 15% increase in revenue per booking
- i18n: 50-100% increase in international users

---

**Document Status**: Complete Implementation Roadmap  
**Last Updated**: January 24, 2026  
**Approval**: Pending Technical Review
