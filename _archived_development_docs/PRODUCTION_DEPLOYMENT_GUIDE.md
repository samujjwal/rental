# Production Deployment Guide

**Platform:** Universal Rental Portal  
**Last Updated:** January 24, 2026  
**Status:** Pre-Production Checklist

---

## 📋 Pre-Deployment Checklist

### Phase 1: External Services Configuration (CRITICAL)

**Estimated Time:** 2-3 hours  
**Priority:** P0 - Blocking

#### ✅ Step 1: SendGrid Email Service

```bash
# 1. Create account at https://sendgrid.com
# 2. Verify sender email
# 3. Create API key with "Full Access"
# 4. Add to .env
SENDGRID_API_KEY=SG.your_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME="Universal Rental Portal"
```

**Test Command:**

```bash
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header "Authorization: Bearer $SENDGRID_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "personalizations": [{
      "to": [{"email": "test@example.com"}]
    }],
    "from": {"email": "noreply@yourdomain.com"},
    "subject": "Test Email",
    "content": [{
      "type": "text/plain",
      "value": "Hello from SendGrid!"
    }]
  }'
```

#### ✅ Step 2: Twilio SMS Service

```bash
# 1. Create account at https://twilio.com
# 2. Purchase phone number
# 3. Get Account SID and Auth Token
# 4. Add to .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Test Command:**

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  --data-urlencode "Body=Test SMS from Rental Portal" \
  --data-urlencode "From=$TWILIO_PHONE_NUMBER" \
  --data-urlencode "To=+1234567890" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

#### ✅ Step 3: Firebase Push Notifications

```bash
# 1. Create project at https://console.firebase.google.com
# 2. Enable Cloud Messaging
# 3. Generate service account key
# 4. Download service-account.json
# 5. Add to .env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----\n"
FCM_SERVER_KEY=AAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### ✅ Step 4: OpenAI Content Moderation

```bash
# 1. Create account at https://platform.openai.com
# 2. Generate API key
# 3. Add to .env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4
MODERATION_CONFIDENCE_THRESHOLD=0.7
```

**Test Command:**

```bash
curl https://api.openai.com/v1/moderations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "input": "Test content for moderation"
  }'
```

#### ✅ Step 5: AWS Services

```bash
# 1. Create AWS account
# 2. Create IAM user with programmatic access
# 3. Attach policies: AmazonS3FullAccess, AmazonRekognitionFullAccess, AmazonTextractFullAccess
# 4. Generate access keys
# 5. Add to .env
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=rental-portal-uploads
AWS_REKOGNITION_MIN_CONFIDENCE=0.8
AWS_TEXTRACT_ENABLED=true
```

**Create S3 Bucket:**

```bash
aws s3 mb s3://rental-portal-uploads --region us-east-1

# Configure CORS
aws s3api put-bucket-cors --bucket rental-portal-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

# Enable versioning
aws s3api put-bucket-versioning --bucket rental-portal-uploads \
  --versioning-configuration Status=Enabled
```

**Test Upload:**

```bash
echo "test" > test.txt
aws s3 cp test.txt s3://rental-portal-uploads/test.txt
aws s3 ls s3://rental-portal-uploads/
```

#### ✅ Step 6: Elasticsearch/OpenSearch

```bash
# Option 1: AWS OpenSearch
# 1. Create OpenSearch domain in AWS Console
# 2. Configure access policy
# 3. Add endpoint to .env

# Option 2: Self-hosted Elasticsearch
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  elasticsearch:8.11.0

# Add to .env
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

**Test Connection:**

```bash
curl -X GET "http://localhost:9200/_cluster/health?pretty"
```

---

### Phase 2: Testing Execution (HIGH PRIORITY)

**Estimated Time:** 4-6 hours  
**Priority:** P1

#### ✅ Step 1: Run Unit Tests

```bash
cd /Users/samujjwal/Development/rental/apps/api
npm run test

# Expected output:
# ✓ All tests passing
# ✓ Coverage > 80%
```

**Fix any failing tests before proceeding!**

#### ✅ Step 2: Run E2E Tests

```bash
cd /Users/samujjwal/Development/rental/apps/api
npm run test:e2e

# Tests to verify:
# ✓ Authentication flow
# ✓ Listing creation
# ✓ Booking creation
# ✓ Payment processing
# ✓ Insurance verification
# ✓ Moderation queue
```

#### ✅ Step 3: Load Testing

```bash
cd /Users/samujjwal/Development/rental/apps/api/test/load

# 1. Start services
docker compose up -d
cd ../../../.. && npm run start:dev

# 2. Run load tests
npm run load:search
npm run load:bookings
npm run load:payments
npm run load:messaging

# Success criteria:
# ✓ Response time p95 < 500ms
# ✓ Error rate < 1%
# ✓ Throughput > 100 req/s
```

#### ✅ Step 4: Security Testing

```bash
cd /Users/samujjwal/Development/rental/apps/api/test/security

# Quick security test
./quick-security-test.sh

# Full OWASP ZAP scan
./zap-scan.sh

# Manual checks:
# ✓ SQL injection attempts fail
# ✓ XSS attempts sanitized
# ✓ CSRF tokens validated
# ✓ Rate limiting works
# ✓ JWT expiration enforced
```

---

### Phase 3: Infrastructure Setup (MEDIUM PRIORITY)

**Estimated Time:** 2-3 days  
**Priority:** P2

#### Step 1: AWS Account Setup

```bash
# 1. Create AWS account if not exists
# 2. Enable MFA on root account
# 3. Create IAM admin user
# 4. Install AWS CLI
# 5. Configure credentials

aws configure
# AWS Access Key ID: [Enter key]
# AWS Secret Access Key: [Enter secret]
# Default region name: us-east-1
# Default output format: json
```

#### Step 2: Terraform Infrastructure

```bash
# Create infrastructure directory
mkdir -p infrastructure/terraform
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan

# Expected resources:
# ✓ VPC with public/private subnets
# ✓ ECS Fargate cluster
# ✓ RDS Aurora PostgreSQL
# ✓ ElastiCache Redis cluster
# ✓ OpenSearch domain
# ✓ Application Load Balancer
# ✓ CloudFront distribution
# ✓ S3 buckets
# ✓ Route 53 DNS records
```

**Terraform Configuration Template:**

```hcl
# infrastructure/terraform/main.tf
provider "aws" {
  region = "us-east-1"
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "rental-portal-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = false

  tags = {
    Environment = "production"
    Project     = "rental-portal"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "rental-portal-cluster"
}

# RDS Aurora
resource "aws_rds_cluster" "postgresql" {
  cluster_identifier      = "rental-portal-db"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = "15.3"
  database_name           = "rental_portal"
  master_username         = "postgres"
  master_password         = random_password.db_password.result
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"

  serverlessv2_scaling_configuration {
    max_capacity = 2.0
    min_capacity = 0.5
  }

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "rental-portal-redis"
  replication_group_description = "Redis cluster for caching"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.t4g.micro"
  number_cache_clusters      = 2
  parameter_group_name       = "default.redis7"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  automatic_failover_enabled = true
}

# OpenSearch
resource "aws_opensearch_domain" "main" {
  domain_name    = "rental-portal-search"
  engine_version = "OpenSearch_2.9"

  cluster_config {
    instance_type  = "t3.small.search"
    instance_count = 2

    zone_awareness_enabled = true
    zone_awareness_config {
      availability_zone_count = 2
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_size = 20
    volume_type = "gp3"
  }

  vpc_options {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.opensearch.id]
  }
}

# ALB
resource "aws_lb" "main" {
  name               = "rental-portal-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = true

  tags = {
    Environment = "production"
  }
}

# CloudFront
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
```

#### Step 3: GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run linter
        run: pnpm run lint

      - name: Run tests
        run: pnpm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_HOST: localhost
          REDIS_PORT: 6379

      - name: Run E2E tests
        run: pnpm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: rental-portal-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG apps/api
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster rental-portal-cluster \
            --service rental-portal-api \
            --force-new-deployment
```

---

### Phase 4: Monitoring Setup (MEDIUM PRIORITY)

**Estimated Time:** 1-2 days  
**Priority:** P2

#### Step 1: Prometheus & Grafana

```bash
# Docker Compose for monitoring stack
cat > docker-compose.monitoring.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:
EOF

# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d
```

**Prometheus Configuration:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'rental-portal-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

#### Step 2: Sentry Error Tracking

```bash
# 1. Create project at https://sentry.io
# 2. Get DSN
# 3. Add to .env
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx

# 4. Install SDK
pnpm add @sentry/node @sentry/tracing

# 5. Initialize in main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

#### Step 3: CloudWatch Alarms

```bash
# Create SNS topic for alerts
aws sns create-topic --name rental-portal-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:rental-portal-alerts \
  --protocol email \
  --notification-endpoint alerts@yourdomain.com

# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu-usage \
  --alarm-description "Trigger when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789:rental-portal-alerts
```

---

### Phase 5: Database Migration & Seeding

**Estimated Time:** 2-4 hours  
**Priority:** P1

```bash
# 1. Backup existing data (if any)
pg_dump -h localhost -U rental_user rental_portal > backup_$(date +%Y%m%d).sql

# 2. Run Prisma migrations
cd packages/database
npx prisma migrate deploy

# 3. Seed initial data
npx prisma db seed

# 4. Verify migration
npx prisma studio
```

---

### Phase 6: SSL/TLS Configuration

**Estimated Time:** 1-2 hours  
**Priority:** P1

```bash
# Option 1: Let's Encrypt (Free)
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Option 2: AWS Certificate Manager (Recommended)
# 1. Go to AWS ACM Console
# 2. Request certificate
# 3. Validate via DNS (Route 53)
# 4. Attach to ALB

aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

---

## 🚀 Deployment Execution

### Staging Deployment

```bash
# 1. Deploy infrastructure
cd infrastructure/terraform
terraform workspace select staging
terraform apply

# 2. Deploy application
git push origin develop

# 3. Run smoke tests
curl https://staging-api.yourdomain.com/health
curl https://staging.yourdomain.com

# 4. Manual testing
# - Test user registration
# - Test listing creation
# - Test booking flow
# - Test payment processing
```

### Production Deployment

```bash
# 1. Create production branch
git checkout -b production
git push origin production

# 2. Deploy infrastructure
cd infrastructure/terraform
terraform workspace select production
terraform apply

# 3. Deploy application
git push origin main

# 4. Database migration
# Run migrations on production database (with backup!)

# 5. Smoke tests
curl https://api.yourdomain.com/health

# 6. Monitor dashboards
# - Check Grafana for metrics
# - Check Sentry for errors
# - Check CloudWatch for alarms

# 7. Gradual rollout
# - Enable for 10% of users
# - Monitor for 1 hour
# - Increase to 50%
# - Monitor for 2 hours
# - Full rollout
```

---

## 📊 Post-Deployment Checklist

### Immediate (Day 1)

- [ ] Verify all services are running
- [ ] Check database connections
- [ ] Test critical user flows
- [ ] Monitor error rates in Sentry
- [ ] Review CloudWatch metrics
- [ ] Test external service integrations

### Short-term (Week 1)

- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Check for security issues
- [ ] Monitor cost/usage
- [ ] Gather user feedback
- [ ] Fix critical bugs

### Medium-term (Month 1)

- [ ] Optimize database queries
- [ ] Scale infrastructure as needed
- [ ] Implement user feedback
- [ ] A/B test new features
- [ ] Review security audit results
- [ ] Plan mobile app development

---

## 🆘 Rollback Procedure

```bash
# If deployment fails, rollback immediately:

# 1. Revert application deployment
aws ecs update-service \
  --cluster rental-portal-cluster \
  --service rental-portal-api \
  --task-definition rental-portal-api:PREVIOUS_VERSION \
  --force-new-deployment

# 2. Revert database migration (if needed)
cd packages/database
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Notify team
# Send alert to team about rollback

# 4. Investigate root cause
# Review logs, errors, metrics

# 5. Fix and redeploy
# Address issues and retry deployment
```

---

## 📞 Support Contacts

- **DevOps Lead:** [Contact Info]
- **Backend Lead:** [Contact Info]
- **Frontend Lead:** [Contact Info]
- **On-Call Engineer:** [Contact Info]
- **AWS Support:** [Support Plan Level]

---

**Document Version:** 1.0  
**Last Review:** January 24, 2026  
**Next Review:** After first production deployment
