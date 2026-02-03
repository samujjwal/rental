# MVP Deployment Guide

## Overview

Cost-effective single-VM deployment for Gharbatai Rentals platform, perfect for starting with 0 users. Reduces costs from $150/month to just $20-30/month while maintaining production-grade quality.

---

## 💰 Cost Comparison

| Setup                 | Monthly Cost | Users | Features                      |
| --------------------- | ------------ | ----- | ----------------------------- |
| **MVP (Recommended)** | **$20-30**   | 0-100 | Single VM, all services       |
| Production            | $150         | 1000+ | Distributed, managed services |
| AWS                   | $340         | 1000+ | Cloud-native, expensive       |

**MVP saves 85% costs while starting out!**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         Single Droplet ($20/mo)      │
│  ┌─────────────────────────────────┐ │
│  │     Nginx (SSL, Reverse Proxy) │ │
│  │  ┌─────────┬─────────────────┐  │ │
│  │  │  Web    │      API        │  │ │
│  │  │ (3000)  │    (3001)       │  │ │
│  │  └─────────┴─────────────────┘  │ │
│  │  ┌─────────┬─────────────────┐  │ │
│  │  │Postgres │     Redis       │  │ │
│  │  │ (5432)  │    (6379)       │  │ │
│  │  └─────────┴─────────────────┘  │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**All services in Docker containers on single VM**

---

## 🚀 Quick Start (30 minutes)

### **1. Create DigitalOcean Droplet**

```bash
# Recommended specs:
- Size: $20/month (1 vCPU, 2GB RAM, 50GB SSD)
- Region: NYC3 (or closest to users)
- Image: Ubuntu 22.04 LTS
- SSH Key: Add your SSH key
```

### **2. Set Up Server**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Run setup script
curl -fsSL https://raw.githubusercontent.com/your-org/gharbatai-rentals/main/scripts/setup-mvp-server.sh | bash

# Reboot when prompted
```

### **3. Configure Environment**

```bash
# Switch to deploy user
su - deploy

# Configure environment
cd ~/gharbatai-rentals
cp .env.mvp.example .env.mvp
nano .env.mvp  # Edit with your values
```

### **4. Deploy Application**

```bash
# Deploy with your domain
./scripts/deploy-mvp.sh yourdomain.com
```

### **5. Configure DNS**

```bash
# Point domain to droplet IP
A Record: @ → droplet-ip
A Record: www → droplet-ip
```

---

## 📁 Files Created

### **Docker Configuration**

- `docker-compose.mvp.yml` - All services in one file
- `nginx/mvp.conf` - Nginx with SSL and rate limiting

### **Deployment Scripts**

- `scripts/setup-mvp-server.sh` - Server initialization
- `scripts/deploy-mvp.sh` - Automated deployment
- `scripts/backup-mvp.sh` - Automated backups

### **Configuration**

- `.env.mvp.example` - Environment template
- `nginx/temp.conf` - Temporary config for SSL

---

## 🔧 Environment Configuration

### **Required Variables**

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# JWT
JWT_SECRET=minimum_32_characters
JWT_REFRESH_SECRET=minimum_32_characters

# Domain
DOMAIN_NAME=yourdomain.com

# DigitalOcean Spaces (optional but recommended)
DO_SPACES_KEY=your_spaces_key
DO_SPACES_SECRET=your_spaces_secret
DO_SPACES_BUCKET=gharbatai-uploads

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (optional)
SENDGRID_API_KEY=SG....
```

### **Optional Variables**

```bash
# Monitoring
SENTRY_DSN=https://...

# Backups
BACKUP_S3_BUCKET=gharbatai-backups
BACKUP_S3_KEY=your_backup_key
BACKUP_S3_SECRET=your_backup_secret

# Notifications
SLACK_WEBHOOK=https://hooks.slack.com/...
```

---

## 🔒 Security Features

### **Built-in Security**

- ✅ Let's Encrypt SSL (automatic renewal)
- ✅ Rate limiting (API: 20r/s, Auth: 10r/m)
- ✅ Security headers (HSTS, CSP, X-Frame-Options)
- ✅ Firewall (UFW) - SSH, HTTP, HTTPS only
- ✅ Fail2ban - Brute force protection
- ✅ Docker isolation
- ✅ Environment variable secrets

### **Recommended Hardening**

```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Monitor logs
sudo tail -f /var/log/nginx/error.log

# Check failed login attempts
sudo grep "Failed password" /var/log/auth.log

# View container status
docker-compose -f docker-compose.mvp.yml ps
```

---

## 💾 Backup Strategy

### **Automated Backups**

- **Database:** Daily PostgreSQL dumps
- **Redis:** Optional Redis snapshots
- **Files:** Config and SSL certificates
- **Retention:** 7 days (configurable)

### **Backup Locations**

1. **Local:** `/home/deploy/gharbatai-rentals/backups/`
2. **Cloud:** DigitalOcean Spaces (optional)

### **Manual Backup**

```bash
# Run backup manually
./scripts/backup-mvp.sh

# View backup files
ls -la backups/
```

### **Restore Procedure**

```bash
# Stop services
docker-compose -f docker-compose.mvp.yml down

# Restore database
gunzip -c backups/postgres-backup-YYYYMMDD-HHMMSS.sql.gz | \
docker exec -i gharbatai-postgres psql -U postgres gharbatai

# Start services
docker-compose -f docker-compose.mvp.yml up -d
```

---

## 📊 Monitoring

### **Health Checks**

```bash
# Check all services
docker-compose -f docker-compose.mvp.yml ps

# View logs
docker-compose -f docker-compose.mvp.yml logs -f

# Check specific service
curl http://localhost/api/health
```

### **Resource Monitoring**

```bash
# System resources
htop
df -h
free -h

# Docker stats
docker stats

# Disk usage by service
docker system df
```

### **Log Monitoring**

```bash
# Application logs
docker-compose -f docker-compose.mvp.yml logs -f api
docker-compose -f docker-compose.mvp.yml logs -f web

# Nginx logs
tail -f nginx/logs/access.log
tail -f nginx/logs/error.log
```

---

## 🔄 Update Process

### **Simple Update**

```bash
# Pull latest code
git pull origin main

# Redeploy
./scripts/deploy-mvp.sh yourdomain.com
```

### **Zero-Downtime Update**

```bash
# Build new images
docker-compose -f docker-compose.mvp.yml build

# Update with rolling restart
docker-compose -f docker-compose.mvp.yml up -d --no-deps --build api web
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **SSL Certificate Issues**

```bash
# Check certificate status
certbot certificates

# Force renewal
certbot renew --force-renewal

# Check Nginx config
nginx -t
```

#### **Database Connection**

```bash
# Check PostgreSQL
docker exec gharbatai-postgres pg_isready

# View database logs
docker logs gharbatai-postgres

# Connect to database
docker exec -it gharbatai-postgres psql -U postgres gharbatai
```

#### **High Memory Usage**

```bash
# Check memory usage
free -h
docker stats

# Restart services if needed
docker-compose -f docker-compose.mvp.yml restart
```

#### **Disk Space**

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -af

# Clean old logs
sudo logrotate -f /etc/logrotate.d/gharbatai-mvp
```

---

## 📈 Scaling Path

### **When to Scale Up**

- **CPU > 80%** for extended periods
- **Memory > 80%** usage
- **Disk > 80%** full
- **Response times > 2s**

### **Scaling Options**

#### **Phase 1: Upgrade Droplet** ($40-80/month)

- 2 vCPU, 4GB RAM, 80GB SSD
- Same setup, more resources

#### **Phase 2: Add Managed Database** (+$60/month)

- Move PostgreSQL to DigitalOcean DB
- Keep Redis in container
- Better performance and backups

#### **Phase 3: Full Production** ($150/month)

- Separate droplets for web/api
- Managed Redis
- Load balancer
- CDN

### **Migration to Production**

```bash
# Export data
./scripts/backup-mvp.sh

# Deploy production setup
./scripts/deploy.sh production

# Import data
# (manual process for migration)
```

---

## 🎯 Performance Optimization

### **For MVP**

- ✅ Nginx gzip compression
- ✅ Static file caching (30 days)
- ✅ Database connection pooling
- ✅ Redis caching
- ✅ HTTP/2 support

### **Optional Optimizations**

```bash
# Add CDN for static assets
# Configure CloudFlare (free)
# Optimize images
# Enable browser caching
```

---

## 📞 Support

### **Getting Help**

1. Check logs: `docker-compose logs`
2. Verify configuration: `.env.mvp`
3. Check health: `curl /api/health`
4. Review this guide

### **Emergency Procedures**

```bash
# Quick restart
docker-compose -f docker-compose.mvp.yml restart

# Full reset
docker-compose -f docker-compose.mvp.yml down
docker-compose -f docker-compose.mvp.yml up -d

# Restore from backup
./scripts/restore-mvp.sh backup-file.sql.gz
```

---

## ✅ MVP Checklist

### **Pre-Deployment**

- [ ] Create DigitalOcean account
- [ ] Create droplet ($20/month)
- [ ] Point DNS to droplet IP
- [ ] Configure environment variables
- [ ] Set up Stripe (if using payments)
- [ ] Configure DigitalOcean Spaces (optional)

### **Post-Deployment**

- [ ] Verify SSL certificate
- [ ] Test all user flows
- [ ] Set up monitoring alerts
- [ ] Verify backup schedule
- [ ] Test restore procedure
- [ ] Document access credentials

---

## 🎉 Summary

The MVP deployment provides:

- **85% cost savings** ($20 vs $150/month)
- **Production-ready** features
- **Easy setup** (30 minutes)
- **Automated** backups and SSL
- **Clear upgrade** path
- **Zero vendor** lock-in

Perfect for starting with 0 users and scaling as you grow!

---

**Status:** ✅ **MVP DEPLOYMENT READY**

**Cost:** $20-30/month  
**Setup Time:** 30 minutes  
**Users:** 0-100 concurrent  
**Upgrade Path:** Clear migration to production setup
