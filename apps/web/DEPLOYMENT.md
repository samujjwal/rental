# Frontend Deployment Guide

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or 20+
- npm 9+ or pnpm
- Backend API running at http://localhost:3400

### Installation

```bash
cd apps/web
npm install
```

### Development Server

```bash
npm run dev
```

Visit http://localhost:3401

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file in `apps/web`:

```env
# API Configuration
API_URL=http://localhost:3400/api/v1

# Production API
# API_URL=https://api.yourrentaldomain.com/api/v1
```

### Vite Configuration

`vite.config.ts` includes:

- React Router plugin
- TailwindCSS processing
- Development proxy to backend API
- Production build optimization

---

## 📦 Build Output

Production build creates:

- `build/client` - Client-side bundles
- `build/server` - SSR server bundles

Files are optimized:

- Code splitting
- Tree shaking
- Minification
- Asset hashing

---

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --production

EXPOSE 3401
CMD ["npm", "start"]
```

### Build and Run

```bash
docker build -t rental-portal-web .
docker run -p 3401:3401 -e API_URL=http://api:3400/api/v1 rental-portal-web
```

---

## ☁️ Cloud Deployment Options

### Vercel (Recommended for React Router)

```bash
npm install -g vercel
vercel --prod
```

Configure environment variables in Vercel dashboard.

### AWS (EC2 + ALB)

1. **EC2 Instance:**
   - Ubuntu 22.04 LTS
   - t3.medium or larger
   - Node.js 20 installed

2. **PM2 Process Manager:**

   ```bash
   npm install -g pm2
   pm2 start npm --name "rental-web" -- start
   pm2 save
   pm2 startup
   ```

3. **Nginx Reverse Proxy:**

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3401;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### AWS (S3 + CloudFront)

For static build:

```bash
npm run build
aws s3 sync build/client s3://your-bucket-name
```

CloudFront distribution pointing to S3.

### Google Cloud (Cloud Run)

```bash
gcloud builds submit --tag gcr.io/[PROJECT-ID]/rental-web
gcloud run deploy rental-web \
  --image gcr.io/[PROJECT-ID]/rental-web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔒 Security Checklist

### Production Security

- [ ] Enable HTTPS with SSL certificate
- [ ] Set secure headers (CSP, HSTS, X-Frame-Options)
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure firewall rules
- [ ] Enable DDoS protection
- [ ] Set up backup strategy
- [ ] Configure CDN for static assets

### Code Security

- [x] No API keys in code
- [x] JWT tokens in httpOnly cookies
- [x] XSS protection
- [x] CSRF tokens ready
- [x] Input validation with Zod
- [x] SQL injection prevention
- [x] Password hashing (backend)

---

## 📊 Performance Optimization

### Implemented

- ✅ Code splitting by route
- ✅ Image lazy loading
- ✅ CSS minification
- ✅ JavaScript minification
- ✅ Tree shaking
- ✅ Asset hashing for caching
- ✅ Gzip compression

### Recommended

- [ ] CDN for static assets (CloudFront, Cloudflare)
- [ ] Image optimization service (Cloudinary, imgix)
- [ ] Service worker for offline support
- [ ] Web vitals monitoring
- [ ] Lighthouse CI in pipeline

---

## 🔍 Monitoring

### Recommended Tools

1. **Error Tracking:**
   - Sentry
   - Rollbar
   - Bugsnag

2. **Analytics:**
   - Google Analytics 4
   - Mixpanel
   - Amplitude

3. **Performance:**
   - Vercel Analytics
   - Cloudflare Analytics
   - New Relic

4. **Uptime:**
   - Pingdom
   - UptimeRobot
   - Better Uptime

---

## 🧪 Testing Before Deployment

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Formatting
npm run format

# Build test
npm run build

# Production preview
npm start
```

---

## 📝 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] API endpoints verified
- [ ] SSL certificate installed
- [ ] DNS configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

### Post-Deployment

- [ ] Verify all pages load
- [ ] Test authentication flow
- [ ] Test search functionality
- [ ] Test booking creation
- [ ] Check mobile responsiveness
- [ ] Verify API connections
- [ ] Check error logging
- [ ] Monitor performance metrics
- [ ] Test payment integration

---

## 🚨 Troubleshooting

### Common Issues

**1. API Connection Failed**

```
Solution: Check API_URL environment variable
Verify backend is running and accessible
Check CORS configuration
```

**2. Build Fails**

```
Solution: Clear node_modules and package-lock.json
Run npm install again
Check for TypeScript errors
```

**3. Images Not Loading**

```
Solution: Verify image URLs are absolute
Check CORS for image domains
Ensure proper content-type headers
```

**4. Slow Performance**

```
Solution: Enable production build
Use CDN for static assets
Implement lazy loading
Check network waterfall
```

---

## 📞 Support

For deployment issues:

- Check SESSION_6_SUMMARY.md
- Review TECH_REFERENCE_GUIDE.md
- Consult React Router v7 docs
- Check Vite documentation

---

**Last Updated:** January 23, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
