# Deployment Guide

This guide covers deploying the GharBatai Nepal Rental Portal to production environments.

## Table of Contents

- [Deployment Strategies](#deployment-strategies)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Rollback Procedures](#rollback-procedures)

## Deployment Strategies

### Single VM Deployment (MVP)

**Best for**: Small to medium applications, quick deployment, lower cost

**Pros**:
- Simple setup
- Lower cost
- Easy to manage
- Fast deployment

**Cons**:
- Single point of failure
- Limited scalability
- Manual scaling

**Recommended for**: MVP, staging, small production

### Multi-VM Deployment

**Best for**: Production environments requiring high availability

**Pros**:
- High availability
- Better performance
- Isolated services
- Easier scaling

**Cons**:
- Higher cost
- Complex setup
- More maintenance

**Recommended for**: Production, high-traffic applications

### Kubernetes Deployment

**Best for**: Large-scale, cloud-native applications

**Pros**:
- Auto-scaling
- Self-healing
- Rolling updates
- Service discovery

**Cons**:
- Complex setup
- Steep learning curve
- Higher infrastructure cost

**Recommended for**: Enterprise, large-scale production

## Pre-Deployment Checklist

### Configuration

- [ ] All environment variables configured in `.env.production`
- [ ] JWT secrets generated (64+ characters)
- [ ] Database credentials set
- [ ] Redis credentials set
- [ ] SSL certificates obtained and configured
- [ ] CORS origins configured
- [ ] Payment gateway configured (Stripe)
- [ ] Email service configured (Resend/SendGrid)
- [ ] Object storage configured (DigitalOcean Spaces/AWS S3)
- [ ] Sentry DSN configured for error tracking

### Security

- [ ] Firewall rules configured
- [ ] SSL/TLS certificates valid
- [ ] Database access restricted
- [ ] API rate limiting enabled
- [ ] Security headers configured
- [ ] CSRF protection enabled
- [ ] Input validation enabled
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

### Database

- [ ] Database backups configured
- [ ] Migration scripts tested
- [ ] Database indexes optimized
- [ ] Connection pooling configured
- [ ] Read replicas set up (if needed)
- [ ] Database monitoring enabled

### Performance

- [ ] CDN configured for static assets
- [ ] Image optimization enabled
- [ ] Caching strategy configured
- [ ] Gzip compression enabled
- [ ] Resource limits set
- [ ] Load testing completed

### Monitoring

- [ ] Application monitoring configured (Sentry)
- [ ] Log aggregation configured
- [ ] Uptime monitoring configured
- [ ] Performance monitoring configured
- [ ] Alert thresholds set
- [ ] On-call procedures defined

## Docker Compose Deployment

### Prerequisites

- Server with Docker and Docker Compose installed
- SSL certificates
- Environment variables configured
- External services (database, Redis) or local Docker services

### Deployment Steps

#### 1. Prepare Server

```bash
# SSH into server
ssh user@your-server

# Clone repository
git clone <repository-url>
cd rental

# Install dependencies
pnpm install
```

#### 2. Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit with production values
nano .env.production
```

#### 3. Setup SSL Certificates

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates (from Let's Encrypt or your provider)
cp /path/to/fullchain.pem nginx/ssl/cert.pem
cp /path/to/privkey.pem nginx/ssl/key.pem

# Set permissions
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
```

#### 4. Build and Deploy

```bash
# Build Docker images
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Start services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Run database migrations
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api pnpm --filter @rental-portal/database migrate:deploy
```

#### 5. Verify Deployment

```bash
# Check service status
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Check logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

# Health checks
curl https://yourdomain.com/api/health
curl https://yourdomain.com
```

#### 6. Setup Automated Backups

```bash
# Add backup script to crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/rental && ./scripts/backup/backup.sh production >> /var/log/rental-backup.log 2>&1
```

### Resource Limits

Configure resource limits in `.env.production`:

```env
# API Service
API_CPU_LIMIT=2.0
API_MEMORY_LIMIT=2G
API_CPU_RESERVATION=1.0
API_MEMORY_RESERVATION=1G

# Web Service
WEB_CPU_LIMIT=1.0
WEB_MEMORY_LIMIT=1G
WEB_CPU_RESERVATION=0.5
WEB_MEMORY_RESERVATION=512M

# Logging
LOG_MAX_SIZE=10m
LOG_MAX_FILE=3
```

### Scaling

#### Vertical Scaling

Increase resource limits in `.env.production`:

```env
API_CPU_LIMIT=4.0
API_MEMORY_LIMIT=4G
```

#### Horizontal Scaling

Use Docker Swarm or Kubernetes for horizontal scaling. See [Kubernetes Deployment](#kubernetes-deployment).

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- kubectl configured
- Helm installed (optional)
- Container registry (Docker Hub, GCR, ECR)

### Deployment Steps

#### 1. Build and Push Images

```bash
# Build API image
docker build -f apps/api/Dockerfile -t your-registry/rental-api:latest .

# Build Web image
docker build -f apps/web/Dockerfile -t your-registry/rental-web:latest .

# Push images
docker push your-registry/rental-api:latest
docker push your-registry/rental-web:latest
```

#### 2. Create Kubernetes Secrets

```bash
# Create secret for environment variables
kubectl create secret generic rental-env \
  --from-env-file=.env.production \
  --namespace=rental

# Create secret for SSL certificates
kubectl create secret tls rental-ssl \
  --cert=nginx/ssl/cert.pem \
  --key=nginx/ssl/key.pem \
  --namespace=rental
```

#### 3. Deploy with Kubernetes Manifests

Create deployment manifests:

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rental-api
  namespace: rental
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rental-api
  template:
    metadata:
      labels:
        app: rental-api
    spec:
      containers:
      - name: api
        image: your-registry/rental-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: rental-env
        resources:
          requests:
            cpu: "1.0"
            memory: "1Gi"
          limits:
            cpu: "2.0"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

```yaml
# web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rental-web
  namespace: rental
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rental-web
  template:
    metadata:
      labels:
        app: rental-web
    spec:
      containers:
      - name: web
        image: your-registry/rental-web:latest
        ports:
        - containerPort: 3000
        env:
        - name: VITE_API_URL
          value: "/api"
        resources:
          requests:
            cpu: "0.5"
            memory: "512Mi"
          limits:
            cpu: "1.0"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: rental-api
  namespace: rental
spec:
  selector:
    app: rental-api
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: rental-web
  namespace: rental
spec:
  selector:
    app: rental-web
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rental-ingress
  namespace: rental
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    secretName: rental-ssl
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: rental-api
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: rental-web
            port:
              number: 80
```

#### 4. Apply Manifests

```bash
# Create namespace
kubectl create namespace rental

# Apply manifests
kubectl apply -f api-deployment.yaml
kubectl apply -f web-deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Verify deployment
kubectl get pods -n rental
kubectl get services -n rental
kubectl get ingress -n rental
```

#### 5. Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rental-api-hpa
  namespace: rental
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rental-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.28.2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run test
      - run: pnpm run typecheck
      - run: pnpm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      - uses: docker/build-push-action@v4
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: ${{ secrets.REGISTRY_URL }}/rental-api:${{ github.sha }}
      - uses: docker/build-push-action@v4
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: true
          tags: ${{ secrets.REGISTRY_URL }}/rental-web:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG }}
      - uses: azure/k8s-deploy@v4
        with:
          manifests: |
            k8s/api-deployment.yaml
            k8s/web-deployment.yaml
            k8s/service.yaml
            k8s/ingress.yaml
          images: |
            ${{ secrets.REGISTRY_URL }}/rental-api:${{ github.sha }}
            ${{ secrets.REGISTRY_URL }}/rental-web:${{ github.sha }}
```

## Monitoring & Maintenance

### Health Checks

```bash
# API health check
curl https://yourdomain.com/api/health

# Web health check
curl https://yourdomain.com

# Database health check
docker compose -f docker-compose.prod.yml exec postgres pg_isready
```

### Log Monitoring

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Performance Monitoring

- **Sentry**: Error tracking and performance monitoring
- **DataDog**: Infrastructure and application monitoring
- **Prometheus/Grafana**: Metrics and dashboards

### Backup Strategy

#### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup (crontab)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

#### File Storage Backups

- Use object storage with versioning
- Enable lifecycle policies
- Cross-region replication for critical data

### Update Procedure

#### Rolling Update

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Rolling restart (zero downtime)
docker compose -f docker-compose.prod.yml up -d --no-deps --build api
docker compose -f docker-compose.prod.yml up -d --no-deps --build web

# Run migrations
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate:deploy
```

#### Blue-Green Deployment

1. Deploy new version to green environment
2. Test green environment
3. Switch traffic from blue to green
4. Monitor for issues
5. Keep blue as rollback option

## Rollback Procedures

### Docker Compose Rollback

```bash
# View previous images
docker images | grep rental

# Rollback to previous version
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d \
  --scale api=3 \
  --scale web=2

# Or rollback database
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate resolve
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/rental-api -n rental

# Rollback to previous version
kubectl rollout undo deployment/rental-api -n rental

# Rollback to specific revision
kubectl rollout undo deployment/rental-api -n rental --to-revision=2
```

### Database Rollback

```bash
# View migration history
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate status

# Rollback specific migration
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate resolve <migration-name>

# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

## Security Hardening

### Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Security Headers

Configure nginx with security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

### Rate Limiting

Configure API rate limiting in environment:

```env
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

## Troubleshooting

### Common Issues

#### Service Not Starting

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check resource usage
docker stats

# Check port conflicts
netstat -tulpn | grep LISTEN
```

#### Database Connection Issues

```bash
# Test database connection
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma db pull

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres
```

#### High Memory Usage

```bash
# Check memory usage
docker stats

# Adjust resource limits in .env.production
API_MEMORY_LIMIT=4G
```

## Next Steps

- [Review RESOURCE_REQUIREMENTS.md](./RESOURCE_REQUIREMENTS.md) for scaling
- [Review INSTALLATION.md](./INSTALLATION.md) for setup
- [Review TESTING.md](./TESTING.md) for testing procedures
