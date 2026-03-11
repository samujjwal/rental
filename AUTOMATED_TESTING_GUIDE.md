# 🤖 Automated Testing Suite Setup Guide

## 📋 Overview

This automated testing suite provides comprehensive validation of the GharBatai Nepal Rental Portal system, covering all components from API endpoints to frontend UI and integrations.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install Node.js dependencies for testing
npm install puppeteer @elastic/elasticsearch redis sharp --save-dev

# Or use the provided package file
cp package-test-automation.json package-test.json
npm install
```

### 2. Ensure Services Are Running
```bash
# Start the development environment
./run-dev.sh

# Verify services are running
curl http://localhost:3400/api/listings  # API
curl http://localhost:3401               # Web Frontend
redis-cli -h localhost -p 3479 ping     # Redis
curl http://localhost:9200/_health       # Elasticsearch
```

### 3. Run All Tests
```bash
# Run the complete automated testing suite
./master-test-suite.sh

# Or run individual test suites
./automated-test-suite.sh              # API Tests
node automated-frontend-tests.js       # Frontend Tests  
node automated-integration-tests.js    # Integration Tests
```

## 📦 Test Suites

### 1. API Endpoint Tests (`automated-test-suite.sh`)
- **Authentication**: Dev-login, regular login, role-based access
- **Listings API**: Property retrieval, pagination, data structure
- **Bookings API**: Price calculation, availability checking
- **Error Handling**: 404 responses, invalid requests, malformed data
- **Performance**: Response time validation
- **Security**: Sensitive data exposure, CORS headers

### 2. Frontend Tests (`automated-frontend-tests.js`)
- **Page Rendering**: All routes load correctly
- **Navigation**: Menu items, routing, redirects
- **UI Components**: Forms, buttons, interactive elements
- **Responsive Design**: Mobile, tablet, desktop layouts
- **Authentication UI**: DevUserSwitcher, login forms
- **API Integration**: Frontend-backend communication
- **Screenshots**: Visual validation of key pages

### 3. Integration Tests (`automated-integration-tests.js`)
- **Redis**: Connection, operations, caching functionality
- **Elasticsearch**: Indexing, search, aggregations
- **Email Service**: Configuration, templates, setup
- **Payment Integration**: Stripe configuration, endpoints
- **File Upload**: Directory setup, image processing
- **Database**: Connection performance, query optimization

### 4. Master Orchestrator (`master-test-suite.sh`)
- **Dependency Checking**: Required tools and packages
- **Service Validation**: All services running correctly
- **Suite Execution**: Runs all test suites in sequence
- **Report Generation**: Comprehensive master report
- **CI/CD Integration**: Ready for automation pipelines

## 📊 Test Reports

### Report Locations
All reports are generated in `./test-results/` with timestamps:
- `master-test-report-YYYYMMDD_HHMMSS.md` - Comprehensive summary
- `automated-test-report-YYYYMMDD_HHMMSS.md` - API test details
- `frontend-test-report-YYYYMMDD_HHMMSS.md` - Frontend test details
- `integration-test-report-YYYYMMDD_HHMMSS.md` - Integration test details

### Report Contents
Each report includes:
- Executive summary with success rates
- Detailed test results with pass/fail status
- Performance metrics and response times
- Recommendations for fixes and improvements
- Screenshots and visual evidence (frontend tests)

## 🔧 Configuration

### Environment Variables
Key environment variables for testing:
```bash
# API Configuration
NODE_ENV=development
API_URL=http://localhost:3400

# Development Login (for testing)
DEV_LOGIN_ENABLED=true
DEV_LOGIN_SECRET=dev-secret-123
VITE_DEV_LOGIN_SECRET=dev-secret-123
VITE_DEV_LOGIN_PASSWORD=password123

# Database
DATABASE_URL="postgresql://rental_user:rental_password@localhost:3432/rental_portal"

# Redis
REDIS_HOST=localhost
REDIS_PORT=3479

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@gharbatai.com

# Stripe (Payment)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Test Configuration
Modify test parameters in the script files:
- **Timeouts**: Adjust for slower systems
- **Retry Logic**: Configure for flaky services
- **Data Volumes**: Change test data sizes
- **Performance Thresholds**: Set acceptable response times

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
name: Automated Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Start Services
        run: docker-compose up -d
      
      - name: Install Dependencies
        run: npm install
      
      - name: Run Tests
        run: ./master-test-suite.sh
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-results/
```

### Scheduled Runs
```bash
# Add to crontab for daily testing
0 2 * * * cd /path/to/rental && ./master-test-suite.sh

# Hourly health checks
0 * * * * cd /path/to/rental && ./automated-test-suite.sh
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Puppeteer Installation
```bash
# Install Puppeteer with local Chromium
npm install puppeteer --save-dev

# Or use system Chrome
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer
```

#### 2. Redis Connection
```bash
# Check Redis is running
redis-cli -h localhost -p 3479 ping

# Start Redis if needed
docker start rental-redis
```

#### 3. Elasticsearch Connection
```bash
# Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# Start Elasticsearch if needed
docker start rental-elasticsearch
```

#### 4. Permission Issues
```bash
# Make scripts executable
chmod +x *.sh

# Fix file permissions
sudo chown -R $USER:$USER test-results/
```

### Debug Mode

#### API Tests
```bash
# Run with verbose output
bash -x ./automated-test-suite.sh

# Test individual endpoints
curl -v http://localhost:3400/api/listings
```

#### Frontend Tests
```bash
# Run with visible browser (for debugging)
# Edit automated-frontend-tests.js
# Change headless: true to headless: false
node automated-frontend-tests.js
```

#### Integration Tests
```bash
# Test Redis manually
redis-cli -h localhost -p 3479
> SET test-key test-value
> GET test-key
> DEL test-key
```

## 📈 Performance Monitoring

### Response Time Tracking
Tests automatically track:
- API endpoint response times
- Database query performance
- Frontend page load times
- Integration service latency

### Performance Thresholds
Default thresholds (configurable):
- API responses: < 2 seconds
- Page loads: < 5 seconds
- Database queries: < 1 second
- Redis operations: < 100ms

### Performance Reports
Each test report includes performance metrics and identifies slow operations.

## 🔄 Continuous Improvement

### Test Maintenance
- Review test results weekly
- Update test data as needed
- Add new tests for new features
- Remove deprecated tests

### Coverage Expansion
- Add edge case testing
- Increase test data variety
- Expand integration scenarios
- Enhance error simulation

### Automation Enhancements
- Add visual regression testing
- Implement load testing
- Set up monitoring dashboards
- Create alerting for failures

## 📞 Support

For issues with the automated testing suite:

1. **Check Logs**: Review individual test reports
2. **Verify Environment**: Ensure all services are running
3. **Update Dependencies**: Run `npm install` for latest packages
4. **Check Configuration**: Verify `.env` file settings
5. **Review Documentation**: Consult this guide and inline comments

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Maintainer**: GharBatai Development Team
