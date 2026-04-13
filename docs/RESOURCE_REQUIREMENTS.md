# Resource Requirements

This document outlines the resource requirements for running the GharBatai Nepal Rental Portal across different environments.

## Table of Contents

- [Development Environment](#development-environment)
- [Test Environment](#test-environment)
- [E2E Test Environment](#e2e-test-environment)
- [Staging Environment](#staging-environment)
- [Production Environment](#production-environment)
- [Infrastructure Services](#infrastructure-services)
- [Scaling Recommendations](#scaling-recommendations)

## Development Environment

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 20 GB SSD
- **OS**: macOS, Linux, or Windows with Docker Desktop

### Recommended Requirements

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD
- **OS**: macOS, Linux, or Windows with Docker Desktop

### Service Resource Allocation

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| Redis | 0.25 cores | 0.1 cores | 256 MB | 128 MB |
| API (dev) | 1.0 cores | 0.5 cores | 512 MB | 256 MB |
| Web (dev) | 0.5 cores | 0.25 cores | 256 MB | 128 MB |

### Port Configuration (Default)

- PostgreSQL: 5432
- Redis: 6379
- API: 3000
- Web: 3001

## Test Environment

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 20 GB SSD

### Recommended Requirements

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD

### Service Resource Allocation

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| Redis | 0.25 cores | 0.1 cores | 256 MB | 128 MB |
| MinIO | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| Mailhog | 0.25 cores | 0.1 cores | 256 MB | 128 MB |

### Port Configuration (Default with offset +1000)

- PostgreSQL: 6432
- Redis: 7379
- MinIO: 10000
- MinIO Console: 10001
- Mailhog: 9025

## E2E Test Environment

### Minimum Requirements

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 30 GB SSD

### Recommended Requirements

- **CPU**: 8 cores
- **RAM**: 16 GB
- **Disk**: 50 GB SSD

### Service Resource Allocation

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| Redis | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| MinIO | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| Mailhog | 0.25 cores | 0.1 cores | 256 MB | 128 MB |
| API (E2E) | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| Web (E2E) | 0.5 cores | 0.25 cores | 512 MB | 256 MB |
| Playwright | 2.0 cores | 1.0 cores | 2 GB | 1 GB |

### Port Configuration (Default with offset +2000)

- PostgreSQL: 7432
- Redis: 8379
- MinIO: 11000
- MinIO Console: 11001
- Mailhog: 10025
- API: 5000
- Web: 5001

## Staging Environment

### Minimum Requirements

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD

### Recommended Requirements

- **CPU**: 8 cores
- **RAM**: 16 GB
- **Disk**: 100 GB SSD

### Service Resource Allocation

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 2.0 cores | 1.0 cores | 2 GB | 1 GB |
| Redis | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| API | 2.0 cores | 1.0 cores | 2 GB | 1 GB |
| Web | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| Nginx | 0.5 cores | 0.25 cores | 512 MB | 256 MB |

### Port Configuration (Default with offset +3000)

- PostgreSQL: 8432
- Redis: 9379
- API: 6000
- Web: 6001
- HTTP: 80
- HTTPS: 443

## Production Environment

### Minimum Requirements

- **CPU**: 8 cores
- **RAM**: 16 GB
- **Disk**: 100 GB SSD

### Recommended Requirements (Small Production)

- **CPU**: 16 cores
- **RAM**: 32 GB
- **Disk**: 200 GB SSD

### Recommended Requirements (Large Production)

- **CPU**: 32 cores
- **RAM**: 64 GB
- **Disk**: 500 GB SSD

### Service Resource Allocation (Small Production)

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 4.0 cores | 2.0 cores | 8 GB | 4 GB |
| Redis | 2.0 cores | 1.0 cores | 4 GB | 2 GB |
| API (x3) | 2.0 cores | 1.0 cores | 2 GB | 1 GB |
| Web (x2) | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| Nginx | 1.0 cores | 0.5 cores | 1 GB | 512 MB |

### Service Resource Allocation (Large Production)

| Service | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|----------------|--------------|-------------------|
| PostgreSQL | 8.0 cores | 4.0 cores | 16 GB | 8 GB |
| Redis | 4.0 cores | 2.0 cores | 8 GB | 4 GB |
| API (x6) | 2.0 cores | 1.0 cores | 2 GB | 1 GB |
| Web (x4) | 1.0 cores | 0.5 cores | 1 GB | 512 MB |
| Nginx (x2) | 1.0 cores | 0.5 cores | 1 GB | 512 MB |

### Port Configuration

- PostgreSQL: 5432 (internal)
- Redis: 6379 (internal)
- API: 3000 (internal)
- Web: 3000 (internal)
- HTTP: 80
- HTTPS: 443

## Infrastructure Services

### External Services

#### Database (PostgreSQL)

- **Version**: 15+ with pgvector extension
- **Storage**: 10 GB minimum for development, 100 GB+ for production
- **Connection Pool**: PgBouncer recommended for production
- **Backups**: Daily backups with 30-day retention

#### Cache (Redis)

- **Version**: 7+
- **Persistence**: AOF enabled
- **Max Memory**: 1 GB minimum, 8 GB+ for production
- **Eviction Policy**: allkeys-lru

#### Object Storage (S3/MinIO/DigitalOcean Spaces)

- **Storage**: 10 GB minimum, unlimited for production
- **CDN**: Recommended for production
- **Lifecycle Rules**: 30-day transition to cold storage

#### Email Service (Resend/SendGrid)

- **Rate Limit**: 3,000 emails/day (Resend free tier)
- **Templates**: Transactional and marketing

#### Payment Processing (Stripe)

- **Webhooks**: Required for payment status updates
- **Test Mode**: Required for development/testing

#### SMS Service (Twilio) - Optional

- **Rate Limit**: Varies by plan
- **Verification**: Required for phone verification

### Monitoring & Logging

#### Application Monitoring

- **Sentry**: Error tracking and performance monitoring
- **DataDog**: Optional for advanced metrics

#### Log Aggregation

- **Log Rotation**: 10 MB per file, 3 files retained
- **Retention**: 30 days for production
- **Centralized Logging**: Recommended for production

## Scaling Recommendations

### Vertical Scaling

Increase resources per instance when:
- CPU utilization consistently > 70%
- Memory utilization consistently > 80%
- Response times > 500ms

### Horizontal Scaling

Add more instances when:
- Single instance can't handle load
- Need high availability
- Want to reduce single point of failure

### Database Scaling

- **Read Replicas**: Add for read-heavy workloads
- **Connection Pooling**: PgBouncer for high connection counts
- **Sharding**: Consider when > 1 TB of data

### Cache Scaling

- **Redis Cluster**: For > 10 GB cache size
- **Multi-Instance**: For high availability

### CDN Scaling

- **Edge Locations**: Use CDN for static assets
- **Image Optimization**: WebP, lazy loading

## Environment-Specific Notes

### Development

- Use Docker Compose for local development
- Enable hot reloading
- Use mock services for external dependencies
- Disable rate limiting

### Test

- Isolated database per test suite
- Parallel test execution support
- Mock external services (Stripe, email, SMS)
- Fast startup/shutdown

### E2E

- Full stack with real infrastructure
- Test database seeding
- Real browser automation
- Screenshot/video capture on failure

### Staging

- Mirror production configuration
- Use test payment gateway
- Limited user base
- Enable all monitoring

### Production

- High availability setup
- Load balancing
- Auto-scaling enabled
- Comprehensive monitoring
- Regular backups
- Security hardening

## Cost Estimates

### Cloud Provider Costs (Monthly)

#### Development/Test

- **DigitalOcean**: $20-50/month
- **AWS**: $50-100/month
- **Google Cloud**: $50-100/month

#### Staging

- **DigitalOcean**: $100-200/month
- **AWS**: $200-400/month
- **Google Cloud**: $200-400/month

#### Production (Small)

- **DigitalOcean**: $200-400/month
- **AWS**: $400-800/month
- **Google Cloud**: $400-800/month

#### Production (Large)

- **DigitalOcean**: $500-1000/month
- **AWS**: $1000-2000/month
- **Google Cloud**: $1000-2000/month

### Third-Party Services

- **Resend (Email)**: Free tier (3,000 emails/month)
- **SendGrid**: $15-100/month
- **Stripe**: 2.9% + 30¢ per transaction
- **Twilio (SMS)**: $0.0079 per SMS segment
- **Sentry**: $26-80/month
- **DataDog**: $15-23/host/month

## Monitoring Metrics

### Key Performance Indicators

- **Response Time**: < 200ms (p95)
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%
- **Database Connections**: < 80% of max
- **Cache Hit Rate**: > 80%
- **Disk Usage**: < 70%

### Alerts

- CPU > 80% for 5 minutes
- Memory > 85% for 5 minutes
- Disk > 80%
- Error rate > 1%
- Response time > 1s (p95)
- Database connection pool exhausted

## Security Considerations

### Resource Limits

- Set CPU/memory limits to prevent resource exhaustion
- Implement rate limiting
- Use request timeouts
- Monitor for resource abuse

### Network

- Use private networks for internal services
- Implement firewalls
- Use TLS for all external connections
- Enable DDoS protection

### Data

- Encrypt at rest and in transit
- Regular security audits
- Implement backup encryption
- Secure key management
