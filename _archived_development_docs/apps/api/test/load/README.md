# Load Testing Documentation

## Overview

This directory contains k6 load testing scripts for the Universal Rental Portal API. These tests simulate real-world traffic patterns to validate system performance, identify bottlenecks, and ensure the application can handle expected production loads.

## Test Suites

### 1. Booking Flow Load Test (`bookings-flow.load.js`)

Tests the complete booking lifecycle under load:

- **Target Load**: 100 concurrent users
- **Duration**: 12 minutes
- **Key Scenarios**:
  - Browse listing details
  - Create booking (instant and request modes)
  - View booking details
  - Owner approval workflow
  - Booking status transitions

**Performance Thresholds**:

- p95 response time: < 500ms
- p99 response time: < 1000ms
- Error rate: < 1%
- Booking creation: < 800ms (p95)
- Booking approval: < 400ms (p95)

**Run Command**:

```bash
k6 run apps/api/test/load/bookings-flow.load.js
```

### 2. Search Queries Load Test (`search-queries.load.js`)

Tests search and discovery features under high read traffic:

- **Target Load**: 200 concurrent users
- **Duration**: 5 minutes
- **Key Scenarios**:
  - Basic keyword search
  - Geo-spatial search with radius
  - Filtered search (price, booking mode, condition)
  - Autocomplete suggestions
  - Advanced search with complex queries

**Performance Thresholds**:

- p95 response time: < 300ms
- p99 response time: < 800ms
- Error rate: < 1%
- Search latency: < 400ms (p95)
- Autocomplete: < 200ms (p95)

**Run Command**:

```bash
k6 run apps/api/test/load/search-queries.load.js
```

### 3. Payment Processing Load Test (`payment-processing.load.js`)

Tests financial operations with high reliability requirements:

- **Target Load**: 50 concurrent users
- **Duration**: 9 minutes
- **Key Scenarios**:
  - Stripe customer creation
  - Payment method management
  - Payment intent creation
  - Security deposit hold/release
  - Ledger queries and balance calculation
  - Payout requests and history

**Performance Thresholds**:

- p95 response time: < 1000ms
- p99 response time: < 2000ms
- Error rate: < 0.5% (very strict)
- Payment intent: < 1200ms (p95)
- Deposit operations: < 1000ms (p95)

**Run Command**:

```bash
k6 run apps/api/test/load/payment-processing.load.js
```

### 4. Real-time Messaging Load Test (`realtime-messaging.load.js`)

Tests WebSocket connections and real-time features:

- **Target Load**: 100 concurrent connections
- **Duration**: 6 minutes
- **Key Scenarios**:
  - WebSocket connection establishment
  - Join conversation rooms
  - Send/receive real-time messages
  - Typing indicators
  - Online status updates
  - Sustained connections (30-60s each)

**Performance Thresholds**:

- Connection time: < 400ms (p95)
- Message latency: < 200ms (p95), < 500ms (p99)
- Error rate: < 5%
- Session duration: stable connections

**Run Command**:

```bash
k6 run apps/api/test/load/realtime-messaging.load.js
```

## Prerequisites

### Install k6

**macOS**:

```bash
brew install k6
```

**Linux**:

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows**:

```powershell
choco install k6
```

**Or via npm**:

```bash
npm install -g k6
```

### Prepare Test Environment

1. **Start the API server**:

```bash
cd apps/api
npm run start:dev
```

2. **Ensure external services are running**:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - Elasticsearch (port 9200)
   - Stripe test mode configured

3. **Set environment variables** (optional):

```bash
export API_URL=http://localhost:3000
export WS_URL=ws://localhost:3000
```

## Running Load Tests

### Single Test

Run a single test script:

```bash
k6 run apps/api/test/load/bookings-flow.load.js
```

### All Tests in Sequence

Run all tests one after another:

```bash
k6 run apps/api/test/load/bookings-flow.load.js && \
k6 run apps/api/test/load/search-queries.load.js && \
k6 run apps/api/test/load/payment-processing.load.js && \
k6 run apps/api/test/load/realtime-messaging.load.js
```

### Custom Parameters

**Override API URL**:

```bash
k6 run --env API_URL=https://staging.example.com apps/api/test/load/bookings-flow.load.js
```

**Adjust VUs (Virtual Users)**:

```bash
k6 run --vus 50 --duration 5m apps/api/test/load/search-queries.load.js
```

**Save results to file**:

```bash
k6 run --out json=results.json apps/api/test/load/bookings-flow.load.js
```

### Cloud Testing with k6 Cloud

Sign up for k6 Cloud and run distributed tests:

```bash
# Login to k6 Cloud
k6 login cloud

# Run test in cloud
k6 cloud apps/api/test/load/bookings-flow.load.js
```

## Analyzing Results

### Real-time Dashboard

k6 provides a real-time terminal dashboard during test execution showing:

- HTTP request metrics (duration, failures)
- Custom metrics (business-specific KPIs)
- Virtual users over time
- Threshold pass/fail status

### Output Formats

**JSON output**:

```bash
k6 run --out json=results.json apps/api/test/load/bookings-flow.load.js
```

**InfluxDB + Grafana**:

```bash
k6 run --out influxdb=http://localhost:8086/k6 apps/api/test/load/bookings-flow.load.js
```

**CSV output**:

```bash
k6 run --out csv=results.csv apps/api/test/load/bookings-flow.load.js
```

### Key Metrics to Monitor

#### HTTP Metrics

- `http_req_duration`: Request duration (p95, p99, median)
- `http_req_failed`: Percentage of failed requests
- `http_reqs`: Total request count
- `http_req_waiting`: Time waiting for response (TTFB)

#### Custom Business Metrics

- `booking_creation_duration`: Time to create a booking
- `search_latency`: Search query response time
- `payment_intent_creation_latency`: Stripe payment intent creation time
- `message_latency`: WebSocket message delivery time
- `errors`: Custom error rate across all operations

#### System Metrics

- `vus`: Active virtual users
- `vus_max`: Peak concurrent users
- `iteration_duration`: Complete user flow duration

## Performance Targets

### Production Readiness Criteria

| Metric                          | Target   | Critical |
| ------------------------------- | -------- | -------- |
| API Response Time (p95)         | < 500ms  | < 1000ms |
| API Response Time (p99)         | < 1000ms | < 2000ms |
| Search Latency (p95)            | < 300ms  | < 800ms  |
| WebSocket Message Latency (p95) | < 200ms  | < 500ms  |
| Error Rate                      | < 1%     | < 5%     |
| Concurrent Users                | 200+     | 100+     |
| Requests per Second             | 500+     | 200+     |

### Scaling Recommendations

Based on load test results:

1. **< 50% of targets**: Investigate bottlenecks
   - Check database query performance
   - Review N+1 query patterns
   - Optimize Elasticsearch queries
   - Add Redis caching where needed

2. **50-80% of targets**: Acceptable for MVP
   - Monitor production metrics
   - Plan optimization sprints
   - Consider horizontal scaling

3. **> 80% of targets**: Production ready
   - Continue monitoring
   - Set up auto-scaling
   - Regular load testing in CI/CD

## Continuous Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *' # Run daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup k6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start services
        run: docker-compose up -d

      - name: Run load tests
        run: |
          k6 run --out json=results.json apps/api/test/load/bookings-flow.load.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: results.json
```

## Troubleshooting

### High Error Rates

**Symptoms**: Error rate > 5%
**Solutions**:

- Check API logs for specific errors
- Verify database connection pool size
- Ensure external services (Stripe, Elasticsearch) are responding
- Review rate limiting configuration

### Slow Response Times

**Symptoms**: p95 > 1000ms
**Solutions**:

- Profile slow database queries
- Add database indexes
- Implement Redis caching
- Optimize Elasticsearch queries
- Review N+1 query patterns

### Connection Failures (WebSocket)

**Symptoms**: WebSocket connections failing
**Solutions**:

- Check Socket.io server configuration
- Verify authentication token validity
- Review WebSocket timeout settings
- Ensure Redis adapter is configured for scaling

### Memory Leaks

**Symptoms**: Memory usage grows over time
**Solutions**:

- Monitor Node.js heap usage
- Check for event listener leaks
- Review WebSocket connection cleanup
- Use Node.js --inspect for profiling

## Best Practices

1. **Run tests in isolated environment**: Don't run load tests against production
2. **Monitor system resources**: CPU, memory, disk I/O during tests
3. **Gradual ramp-up**: Use stages to gradually increase load
4. **Realistic think time**: Add sleep() between requests to simulate real users
5. **Clean up test data**: Implement teardown to remove test data
6. **Version control results**: Track performance over time
7. **Set realistic thresholds**: Based on business requirements
8. **Test with production-like data**: Use representative dataset sizes

## Next Steps

1. **Baseline Performance**: Run initial tests to establish baselines
2. **Optimize**: Address identified bottlenecks
3. **Re-test**: Validate optimizations with follow-up load tests
4. **Automate**: Integrate into CI/CD pipeline
5. **Monitor Production**: Set up APM tools (New Relic, DataDog, etc.)
6. **Capacity Planning**: Use results to plan infrastructure scaling

## Support

For issues or questions:

- Review k6 documentation: https://k6.io/docs/
- Check API logs: `docker-compose logs api`
- Monitor system metrics: `docker stats`
- Contact DevOps team for infrastructure issues
