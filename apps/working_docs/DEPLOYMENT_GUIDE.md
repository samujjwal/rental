# Production Deployment Guide

## Overview

This guide covers deploying the Gharbatai Rentals platform to production with cost-effective infrastructure, high availability, and production-grade security.

---

## 🏗️ Infrastructure Options Comparison

### **Recommended: DigitalOcean** ⭐

**Why DigitalOcean:**

- ✅ **Cost-effective:** 40-60% cheaper than AWS
- ✅ **Simple pricing:** No hidden costs
- ✅ **Managed services:** PostgreSQL, Redis, Spaces (S3-compatible)
- ✅ **Good performance:** SSD-based infrastructure
- ✅ **Easy to use:** Simpler than AWS
- ✅ **Great for startups:** Predictable costs

**Monthly Cost Estimate:**

```
Production Environment:
- App Droplet (2 vCPU, 4GB RAM): $24/month
- Database (2 vCPU, 4GB RAM): $60/month
- Redis (1GB): $15/month
- Spaces (250GB + CDN): $5/month
- Load Balancer: $12/month
- Backups: $10/month
Total: ~$126/month

Staging Environment:
- App Droplet (1 vCPU, 2GB RAM): $12/month
- Database (shared): $15/month
Total: ~$27/month

Grand Total: ~$153/month
```

### **Alternative: AWS (More Expensive)**

**Monthly Cost Estimate:**

```
Production Environment:
- EC2 t3.medium (2 vCPU, 4GB): $30/month
- RDS PostgreSQL db.t3.medium: $120/month
- ElastiCache Redis: $50/month
- S3 + CloudFront: $20/month
- ALB: $20/month
- Backups: $20/month
Total: ~$260/month

Staging: ~$80/month
Grand Total: ~$340/month
```

### **Alternative: Railway/Render (Easiest)**

**Monthly Cost Estimate:**

```
Production:
- Web Service: $20/month
- API Service: $20/month
- PostgreSQL: $20/month
- Redis: $10/month
Total: ~$70/month

Note: Limited scalability, good for MVP
```

---

## 🎯 Recommended Architecture (DigitalOcean)

```
┌─────────────────────────────────────────────────────────┐
│                     CloudFlare CDN                       │
│                  (Free SSL, DDoS Protection)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              DigitalOcean Load Balancer                  │
│                    (Health Checks)                       │
└────────┬───────────────────────────────┬────────────────┘
         │                               │
┌────────▼────────┐            ┌────────▼────────┐
│  App Droplet 1  │            │  App Droplet 2  │
│  (Web + API)    │            │  (Web + API)    │
│  Docker Compose │            │  Docker Compose │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐ ┌───▼────┐ ┌───────▼────────┐
│  PostgreSQL DB  │ │ Redis  │ │ Spaces (S3)    │
│   (Managed)     │ │(Managed)│ │ (Object Store) │
└─────────────────┘ └────────┘ └────────────────┘
```

---

## 📦 Docker Configuration

### **1. API Dockerfile**

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN cd packages/database && npx prisma generate

# Build API
RUN cd apps/api && pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
```

### **2. Web Dockerfile**

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build web app
RUN cd apps/web && pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

COPY --from=builder --chown=remix:nodejs /app/apps/web/build ./build
COPY --from=builder --chown=remix:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remix:nodejs /app/apps/web/package.json ./

USER remix

EXPOSE 3000

CMD ["npm", "start"]
```

### **3. Docker Compose (Production)**

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - '3001:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - AWS_ACCESS_KEY_ID=${DO_SPACES_KEY}
      - AWS_SECRET_ACCESS_KEY=${DO_SPACES_SECRET}
      - AWS_REGION=nyc3
      - AWS_S3_BUCKET=${DO_SPACES_BUCKET}
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - API_URL=http://api:3000
    depends_on:
      - api
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000']
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - web
      - api
    restart: unless-stopped
```

### **4. Nginx Configuration**

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream web {
        server web:3000;
    }

    upstream api {
        server api:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web_limit:10m rate=20r/s;

    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000" always;

        # API routes
        location /api {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Web routes
        location / {
            limit_req zone=web_limit burst=40 nodelay;
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Static files
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://web;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

---

## 🚀 Deployment Steps

### **Phase 1: DigitalOcean Setup**

#### **1. Create DigitalOcean Account**

```bash
# Sign up at digitalocean.com
# Add payment method
# Get $200 credit with referral link
```

#### **2. Create Managed Database**

```bash
# Via DigitalOcean Console:
1. Go to Databases → Create Database
2. Select PostgreSQL 15
3. Choose plan: 2 vCPU, 4GB RAM ($60/month)
4. Select region: NYC3 (or closest to users)
5. Enable automatic backups
6. Create database: gharbatai_prod

# Get connection string:
postgresql://user:password@host:25060/gharbatai_prod?sslmode=require
```

#### **3. Create Redis Cluster**

```bash
# Via DigitalOcean Console:
1. Go to Databases → Create Database
2. Select Redis
3. Choose plan: 1GB ($15/month)
4. Select same region as PostgreSQL
5. Create cluster

# Get connection string:
rediss://user:password@host:25061
```

#### **4. Create Spaces (Object Storage)**

```bash
# Via DigitalOcean Console:
1. Go to Spaces → Create Space
2. Name: gharbatai-uploads
3. Region: NYC3
4. Enable CDN
5. Create API keys (Access Key + Secret)

# Configuration:
Endpoint: nyc3.digitaloceanspaces.com
Bucket: gharbatai-uploads
CDN: gharbatai-uploads.nyc3.cdn.digitaloceanspaces.com
```

#### **5. Create Droplets**

```bash
# Via DigitalOcean Console:
1. Go to Droplets → Create Droplet
2. Choose Ubuntu 22.04 LTS
3. Plan: Basic, 2 vCPU, 4GB RAM ($24/month)
4. Add SSH key
5. Enable monitoring
6. Create 2 droplets: app-1, app-2

# Or via CLI:
doctl compute droplet create app-1 \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc3 \
  --ssh-keys your-ssh-key-id \
  --enable-monitoring
```

---

### **Phase 2: Server Setup**

#### **1. Initial Server Configuration**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create deploy user
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Set up firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install fail2ban
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

#### **2. Set Up Application**

```bash
# Switch to deploy user
su - deploy

# Clone repository
git clone https://github.com/your-org/gharbatai-rentals.git
cd gharbatai-rentals

# Create .env file
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:25060/gharbatai_prod?sslmode=require
REDIS_URL=rediss://user:password@host:25061
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
DO_SPACES_KEY=your-access-key
DO_SPACES_SECRET=your-secret-key
DO_SPACES_BUCKET=gharbatai-uploads
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_CDN=gharbatai-uploads.nyc3.cdn.digitaloceanspaces.com
EOF

# Run database migrations
cd packages/database
npx prisma migrate deploy
npx prisma db seed

# Build and start services
cd ../..
docker-compose -f docker-compose.prod.yml up -d
```

---

### **Phase 3: Load Balancer Setup**

#### **1. Create Load Balancer**

```bash
# Via DigitalOcean Console:
1. Go to Networking → Load Balancers → Create
2. Name: gharbatai-lb
3. Region: NYC3
4. Add droplets: app-1, app-2
5. Forwarding Rules:
   - HTTP (80) → HTTP (80)
   - HTTPS (443) → HTTP (80)
6. Health Checks:
   - Protocol: HTTP
   - Port: 80
   - Path: /health
   - Interval: 10s
7. SSL Certificate: Let's Encrypt (auto-provision)
8. Create Load Balancer
```

#### **2. Configure DNS**

```bash
# Point your domain to load balancer IP:
A Record: @ → load-balancer-ip
A Record: www → load-balancer-ip
A Record: api → load-balancer-ip
```

---

### **Phase 4: CI/CD Pipeline**

#### **1. GitHub Actions Workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test

      - name: Run linter
        run: pnpm lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push API
        uses: docker/build-push-action@v4
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: yourorg/gharbatai-api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Web
        uses: docker/build-push-action@v4
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: yourorg/gharbatai-web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/gharbatai-rentals
            git pull origin main
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
            docker system prune -f
```

#### **2. GitHub Secrets**

```bash
# Add these secrets to GitHub repository:
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
DROPLET_IP=your-droplet-ip
SSH_PRIVATE_KEY=your-ssh-private-key
```

---

### **Phase 5: Monitoring & Logging**

#### **1. Set Up Monitoring**

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - '9090:9090'
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter
    ports:
      - '9100:9100'
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

#### **2. Logging with Loki**

```yaml
# Add to docker-compose.prod.yml
loki:
  image: grafana/loki
  ports:
    - '3100:3100'
  volumes:
    - ./loki-config.yml:/etc/loki/local-config.yaml
  restart: unless-stopped

promtail:
  image: grafana/promtail
  volumes:
    - /var/log:/var/log
    - ./promtail-config.yml:/etc/promtail/config.yml
  restart: unless-stopped
```

---

## 🔒 Security Checklist

### **Application Security**

- ✅ Environment variables for secrets
- ✅ JWT with refresh tokens
- ✅ Rate limiting (nginx)
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection prevention (Prisma)
- ✅ XSS protection
- ✅ CSRF protection

### **Infrastructure Security**

- ✅ Firewall (UFW)
- ✅ Fail2ban for brute force protection
- ✅ SSL/TLS (Let's Encrypt)
- ✅ Security headers (nginx)
- ✅ Database SSL connections
- ✅ Redis password authentication
- ✅ Private networking for services
- ✅ Regular security updates

### **Monitoring**

- ✅ Application logs
- ✅ Error tracking (Sentry)
- ✅ Performance monitoring
- ✅ Uptime monitoring
- ✅ Database backups
- ✅ Automated alerts

---

## 📊 Cost Optimization Tips

### **1. Use Reserved Instances**

- Commit to 1 year for 20% discount
- Commit to 3 years for 40% discount

### **2. Optimize Database**

- Use connection pooling
- Enable query caching
- Regular vacuum and analyze
- Index optimization

### **3. CDN for Static Assets**

- Use DigitalOcean Spaces CDN
- Or CloudFlare (free tier)
- Compress images
- Enable browser caching

### **4. Auto-scaling**

- Scale horizontally during peak hours
- Scale down during off-peak
- Use load balancer health checks

---

## 🚨 Disaster Recovery

### **1. Automated Backups**

```bash
# Database backups (automated by DO)
# Retention: 7 days

# Manual backup script
#!/bin/bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
doctl spaces upload backup-$(date +%Y%m%d).sql gharbatai-backups/
```

### **2. Restore Procedure**

```bash
# Restore from backup
psql $DATABASE_URL < backup-20260202.sql

# Or use DigitalOcean console:
# Databases → Your DB → Backups → Restore
```

---

## 📈 Scaling Strategy

### **Current Setup (Month 1-3)**

- 2 App Droplets
- Managed PostgreSQL
- Managed Redis
- Load Balancer
- **Cost:** ~$150/month
- **Capacity:** ~1000 concurrent users

### **Growth Phase (Month 4-12)**

- 4 App Droplets
- Larger Database (4 vCPU, 8GB)
- Redis cluster
- **Cost:** ~$300/month
- **Capacity:** ~5000 concurrent users

### **Scale Phase (Year 2+)**

- Auto-scaling droplet pool (4-10 instances)
- Database read replicas
- Redis cluster with failover
- Multi-region deployment
- **Cost:** ~$600-1000/month
- **Capacity:** ~20,000+ concurrent users

---

## 🎯 Deployment Checklist

### **Pre-Deployment**

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates obtained
- [ ] DNS configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

### **Deployment**

- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor logs
- [ ] Test critical flows

### **Post-Deployment**

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups
- [ ] Update documentation
- [ ] Notify team

---

## 📞 Support & Resources

**DigitalOcean:**

- Docs: https://docs.digitalocean.com
- Community: https://www.digitalocean.com/community
- Support: 24/7 ticket system

**Monitoring:**

- Grafana dashboards
- Prometheus alerts
- Log aggregation with Loki

**Cost Tracking:**

- DigitalOcean billing dashboard
- Set up billing alerts
- Monthly cost reviews

---

**Estimated Total Setup Time:** 4-6 hours  
**Monthly Cost:** ~$150-200  
**Maintenance:** ~2-4 hours/month

**Status:** Ready for deployment with production-grade infrastructure
