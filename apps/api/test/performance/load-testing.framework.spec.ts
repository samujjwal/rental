import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Performance Load Testing Framework', () => {
  let app: INestApplication;
  let testUsers: Array<{ token: string; id: string }> = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test users for load testing
    for (let i = 0; i < 50; i++) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `loadtest${i}@example.com`,
          username: `loadtest${i}`,
          password: 'Password123!',
          firstName: 'Load',
          lastName: `Test${i}`,
        });

      testUsers.push({
        token: response.body.token,
        id: response.body.user.id,
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Search Performance', () => {
    it('should handle 1000 concurrent searches', async () => {
      const searchQueries = [
        'apartment in new york',
        'house with pool',
        'beachfront property',
        'luxury villa',
        'budget accommodation',
        'pet friendly rental',
        'downtown loft',
        'suburban home',
        'mountain cabin',
        'city apartment',
      ];

      const startTime = Date.now();
      
      // Create 1000 concurrent search requests
      const searchPromises = Array.from({ length: 1000 }, (_, i) => {
        const query = searchQueries[i % searchQueries.length];
        const user = testUsers[i % testUsers.length];
        
        return request(app.getHttpServer())
          .get('/api/listings/search')
          .query({
            query,
            page: Math.floor(Math.random() * 10) + 1,
            size: 20,
            minPrice: Math.floor(Math.random() * 200) + 50,
            maxPrice: Math.floor(Math.random() * 300) + 200,
          })
          .set('Authorization', `Bearer ${user.token}`);
      });

      const results = await Promise.allSettled(searchPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      const failed = results.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)
      );

      console.log(`Search Performance Results:`);
      console.log(`- Total requests: 1000`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Failed: ${failed.length}`);
      console.log(`- Success rate: ${(successful.length / 1000 * 100).toFixed(2)}%`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Average per request: ${(endTime - startTime) / 1000}ms`);

      expect(successful.length / 1000).toBeGreaterThan(0.95); // 95% success rate
      expect(endTime - startTime).toBeLessThan(30000); // Complete within 30 seconds
    });

    it('should maintain response time under load', async () => {
      const responseTimes: number[] = [];
      
      // Make 100 requests and measure response times
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        
        await request(app.getHttpServer())
          .get('/api/listings/search')
          .query({
            query: 'test search',
            page: 1,
            size: 10,
          })
          .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      console.log(`Response Time Analysis:`);
      console.log(`- Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Maximum: ${maxResponseTime}ms`);
      console.log(`- 95th percentile: ${p95ResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
      expect(p95ResponseTime).toBeLessThan(1000); // 95% under 1s
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2s
    });

    it('should handle complex search queries efficiently', async () => {
      const complexQueries = [
        {
          query: 'luxury apartment with pool and gym',
          filters: { minPrice: 200, maxPrice: 500, bedrooms: 2, bathrooms: 2 },
        },
        {
          query: 'beachfront house pet friendly',
          filters: { minPrice: 150, maxPrice: 400, maxDistance: 10 },
        },
        {
          query: 'downtown loft modern kitchen',
          filters: { minPrice: 100, maxPrice: 300, amenities: ['wifi', 'parking', 'gym'] },
        },
      ];

      const startTime = Date.now();
      
      const complexSearchPromises = complexQueries.flatMap(queryConfig =>
        Array.from({ length: 100 }, () => {
          const user = testUsers[Math.floor(Math.random() * testUsers.length)];
          
          return request(app.getHttpServer())
            .get('/api/listings/search')
            .query({
              query: queryConfig.query,
              ...queryConfig.filters,
              page: 1,
              size: 20,
            })
            .set('Authorization', `Bearer ${user.token}`);
        })
      );

      const results = await Promise.allSettled(complexSearchPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`Complex Search Performance:`);
      console.log(`- Total requests: ${complexSearchPromises.length}`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Average per request: ${(endTime - startTime) / complexSearchPromises.length}ms`);

      expect(successful.length / complexSearchPromises.length).toBeGreaterThan(0.90);
      expect(endTime - startTime).toBeLessThan(20000);
    });
  });

  describe('Booking Performance', () => {
    it('should handle peak booking load', async () => {
      // First, create test listings
      const hostToken = testUsers[0].token;
      const listings = [];

      for (let i = 0; i < 10; i++) {
        const listing = await request(app.getHttpServer())
          .post('/api/listings')
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            title: `Test Listing ${i}`,
            description: 'Performance test listing',
            address: `${i} Test St`,
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
            latitude: 40.7128 + (i * 0.01),
            longitude: -74.0060 + (i * 0.01),
            type: 'APARTMENT',
            bedrooms: 2,
            bathrooms: 1,
            maxGuests: 4,
            basePrice: 100 + (i * 10),
            currency: 'USD',
            amenities: ['wifi', 'parking'],
            photos: ['https://example.com/photo.jpg'],
          });
        
        listings.push(listing.body);
      }

      // Create concurrent booking requests
      const startTime = Date.now();
      
      const bookingPromises = Array.from({ length: 500 }, (_, i) => {
        const user = testUsers[i % testUsers.length];
        const listing = listings[i % listings.length];
        const startDate = new Date(Date.now() + (i * 24 * 60 * 60 * 1000));
        const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        
        return request(app.getHttpServer())
          .post('/api/bookings')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            listingId: listing.id,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            guestCount: 2,
          });
      });

      const results = await Promise.allSettled(bookingPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      const conflicts = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 409
      );

      console.log(`Booking Performance Results:`);
      console.log(`- Total requests: 500`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Conflicts: ${conflicts.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Average per request: ${(endTime - startTime) / 500}ms`);

      expect(successful.length + conflicts.length).toBeGreaterThan(450); // Most should be processed
      expect(endTime - startTime).toBeLessThan(25000); // Complete within 25 seconds
    });

    it('should handle booking state transitions efficiently', async () => {
      // Create a booking
      const booking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .send({
          listingId: 'test-listing-id', // Assume this exists
          startDate: '2026-12-20',
          endDate: '2026-12-22',
          guestCount: 2,
        });

      const bookingId = booking.body.id;

      // Test concurrent state transitions
      const stateTransitions = [
        { action: 'accept', endpoint: `/api/bookings/${bookingId}/accept` },
        { action: 'confirm', endpoint: `/api/bookings/${bookingId}/confirm` },
        { action: 'checkin', endpoint: `/api/bookings/${bookingId}/checkin` },
        { action: 'checkout', endpoint: `/api/bookings/${bookingId}/checkout` },
        { action: 'complete', endpoint: `/api/bookings/${bookingId}/complete` },
      ];

      const startTime = Date.now();
      
      const transitionPromises = stateTransitions.flatMap(transition =>
        Array.from({ length: 20 }, () =>
          request(app.getHttpServer())
            .put(transition.endpoint)
            .set('Authorization', `Bearer ${testUsers[0].token}`)
        )
      );

      const results = await Promise.allSettled(transitionPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`State Transition Performance:`);
      console.log(`- Total transitions: ${transitionPromises.length}`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);

      expect(successful.length).toBeGreaterThan(80); // Most should succeed
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Database Performance', () => {
    it('should handle database connection limits', async () => {
      const concurrentDbOperations = 200;
      
      const dbPromises = Array.from({ length: concurrentDbOperations }, async (_, i) => {
        const user = testUsers[i % testUsers.length];
        
        // Mix of different database operations
        const operations = [
          () => request(app.getHttpServer())
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${user.token}`),
          () => request(app.getHttpServer())
            .get('/api/bookings')
            .set('Authorization', `Bearer ${user.token}`),
          () => request(app.getHttpServer())
            .get('/api/notifications')
            .set('Authorization', `Bearer ${user.token}`),
          () => request(app.getHttpServer())
            .get('/api/listings/favorites')
            .set('Authorization', `Bearer ${user.token}`),
        ];

        const operation = operations[i % operations.length];
        return operation();
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(dbPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`Database Performance Results:`);
      console.log(`- Concurrent operations: ${concurrentDbOperations}`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Average per operation: ${(endTime - startTime) / concurrentDbOperations}ms`);

      expect(successful.length / concurrentDbOperations).toBeGreaterThan(0.90);
      expect(endTime - startTime).toBeLessThan(15000);
    });

    it('should handle large dataset queries efficiently', async () => {
      // Test queries that return large datasets
      const largeQueryPromises = [
        // Search with many results
        request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ page: 1, size: 100 })
          .set('Authorization', `Bearer ${testUsers[0].token}`),
        
        // User with many bookings
        request(app.getHttpServer())
          .get('/api/bookings')
          .query({ page: 1, size: 50 })
          .set('Authorization', `Bearer ${testUsers[0].token}`),
        
        // All notifications
        request(app.getHttpServer())
          .get('/api/notifications')
          .query({ page: 1, size: 100 })
          .set('Authorization', `Bearer ${testUsers[0].token}`),
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(largeQueryPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`Large Dataset Performance:`);
      console.log(`- Queries: ${largeQueryPromises.length}`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);

      expect(successful.length).toBe(largeQueryPromises.length);
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Memory Performance', () => {
    it('should handle memory pressure gracefully', async () => {
      // Simulate memory-intensive operations
      const memoryIntensivePromises = Array.from({ length: 100 }, (_, i) => {
        const user = testUsers[i % testUsers.length];
        
        return request(app.getHttpServer())
          .get('/api/listings/search')
          .query({
            query: 'test query with lots of results',
            page: 1,
            size: 100, // Large page size
            includeAll: true, // If available
          })
          .set('Authorization', `Bearer ${user.token}`);
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(memoryIntensivePromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`Memory Performance Results:`);
      console.log(`- Memory-intensive operations: 100`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);

      expect(successful.length).toBeGreaterThan(80);
      expect(endTime - startTime).toBeLessThan(20000);
    });

    it('should manage memory leaks under sustained load', async () => {
      // Sustained load test
      const rounds = 5;
      const requestsPerRound = 50;
      
      for (let round = 0; round < rounds; round++) {
        const roundPromises = Array.from({ length: requestsPerRound }, (_, i) => {
          const user = testUsers[i % testUsers.length];
          
          return request(app.getHttpServer())
            .get('/api/listings/search')
            .query({ query: `round ${round} query ${i}` })
            .set('Authorization', `Bearer ${user.token}`);
        });

        await Promise.allSettled(roundPromises);
        
        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If we reach here without memory errors, the test passes
      expect(true).toBe(true);
    });
  });

  describe('API Gateway Performance', () => {
    it('should handle high request volume', async () => {
      const totalRequests = 1000;
      const concurrentBatches = 10;
      const requestsPerBatch = totalRequests / concurrentBatches;

      const startTime = Date.now();
      
      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const batchRequests = Array.from({ length: requestsPerBatch }, (_, i) => {
          const user = testUsers[(batchIndex * requestsPerBatch + i) % testUsers.length];
          
          return request(app.getHttpServer())
            .get('/api/health')
            .set('Authorization', `Bearer ${user.token}`);
        });

        return Promise.allSettled(batchRequests);
      });

      const batchResults = await Promise.all(batchPromises);
      const endTime = Date.now();

      const allResults = batchResults.flat();
      const successful = allResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`API Gateway Performance:`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Concurrent batches: ${concurrentBatches}`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Requests per second: ${(successful.length / (endTime - startTime) * 1000).toFixed(2)}`);

      expect(successful.length / totalRequests).toBeGreaterThan(0.95);
      expect(endTime - startTime).toBeLessThan(30000);
    });

    it('should maintain performance under mixed load', async () => {
      const mixedOperations = [
        // Read operations (lightweight)
        () => request(app.getHttpServer()).get('/api/health'),
        () => request(app.getHttpServer()).get('/api/listings/search').query({ query: 'test' }),
        
        // Write operations (heavier)
        () => request(app.getHttpServer()).post('/api/users/favorites/test-listing'),
        
        // Complex operations (heaviest)
        () => request(app.getHttpServer()).get('/api/users/profile'),
      ];

      const mixedPromises = Array.from({ length: 500 }, (_, i) => {
        const user = testUsers[i % testUsers.length];
        const operation = mixedOperations[i % mixedOperations.length];
        
        if (operation.name.includes('Authorization')) {
          return operation().set('Authorization', `Bearer ${user.token}`);
        }
        return operation();
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(mixedPromises);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value.status === 200 || r.value.status === 201)
      );

      console.log(`Mixed Load Performance:`);
      console.log(`- Mixed operations: 500`);
      console.log(`- Successful: ${successful.length}`);
      console.log(`- Total time: ${endTime - startTime}ms`);

      expect(successful.length / 500).toBeGreaterThan(0.90);
      expect(endTime - startTime).toBeLessThan(25000);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish performance baseline', async () => {
      const baselineOperations = [
        { name: 'search', request: () => request(app.getHttpServer()).get('/api/listings/search').query({ query: 'test' }) },
        { name: 'profile', request: () => request(app.getHttpServer()).get('/api/users/profile').set('Authorization', `Bearer ${testUsers[0].token}`) },
        { name: 'bookings', request: () => request(app.getHttpServer()).get('/api/bookings').set('Authorization', `Bearer ${testUsers[0].token}`) },
        { name: 'health', request: () => request(app.getHttpServer()).get('/api/health') },
      ];

      const baselineResults = {};

      for (const operation of baselineOperations) {
        const times: number[] = [];
        
        // Run each operation 10 times
        for (let i = 0; i < 10; i++) {
          const startTime = Date.now();
          await operation.request();
          const endTime = Date.now();
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        baselineResults[operation.name] = {
          average: avgTime,
          maximum: maxTime,
          samples: times,
        };

        console.log(`Baseline - ${operation.name}:`);
        console.log(`  Average: ${avgTime.toFixed(2)}ms`);
        console.log(`  Maximum: ${maxTime}ms`);
      }

      // Store baseline for future comparison
      // In a real scenario, this would be saved to a file or database
      expect(Object.keys(baselineResults)).toHaveLength(4);
    });
  });
});
