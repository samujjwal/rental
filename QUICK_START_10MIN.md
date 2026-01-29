# 🚀 Quick Start Guide - Get Running in 10 Minutes

## Step 1: Validate Environment (2 minutes)

```bash
# Run quick validation
./quick-validate.sh

# Should show:
# ✓ Node.js installed
# ✓ pnpm installed
# ✓ Project structure correct
# ✓ Dependencies installed
```

## Step 2: Start Services (3 minutes)

```bash
# Terminal 1: Start Docker services
docker-compose up -d

# Wait for services to be healthy (30 seconds)
docker ps  # All should show "healthy"

# Terminal 2: Start API
cd apps/api
pnpm install  # If not done
pnpm dev      # API starts on http://localhost:3400

# Terminal 3: Start Web
cd apps/web
pnpm install  # If not done
pnpm dev      # Web starts on http://localhost:3401
```

## Step 3: Test Basic Flow (5 minutes)

### Open Browser: http://localhost:3401

1. **Sign Up** → Create new account
2. **Verify Email** → Check terminal for verification link
3. **Search** → Try searching for "guitar"
4. **View Listing** → Click any listing
5. **Admin** → Login as admin (if configured)

### Test API: http://localhost:3400/api/docs

1. Open Swagger docs
2. Try `/health` endpoint
3. Try `/categories` endpoint

## 🔧 Common Issues & Fixes

### Issue: "Port already in use"

```bash
# Find and kill process using port
lsof -ti:3400 | xargs kill -9  # API port
lsof -ti:3401 | xargs kill -9  # Web port
lsof -ti:5432 | xargs kill -9  # Postgres port
```

### Issue: "Database connection failed"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, start it
docker-compose up -d postgres

# Run migrations
cd packages/database
npx prisma migrate dev
npx prisma generate
```

### Issue: "Module not found"

```bash
# Reinstall dependencies
pnpm install

# Or clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: ".env file not found"

```bash
# Copy example env file
cp apps/api/.env.example apps/api/.env

# Edit and add your values
nano apps/api/.env  # or use your editor
```

## 📋 Essential Commands

### Development

```bash
pnpm dev                 # Start all services (Turbo)
cd apps/api && pnpm dev  # Start API only
cd apps/web && pnpm dev  # Start Web only
```

### Database

```bash
cd packages/database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate client
npx prisma db seed       # Seed data
```

### Testing

```bash
cd apps/api
pnpm test               # Run unit tests
pnpm test:e2e          # Run E2E tests
pnpm test:cov          # Coverage report
```

### Docker

```bash
docker-compose up -d              # Start all services
docker-compose down              # Stop all services
docker-compose logs -f [service] # View logs
docker-compose restart [service] # Restart service
```

## 🎯 Quick Testing Checklist

### ✅ Backend API

- [ ] http://localhost:3400/health returns `{"status":"ok"}`
- [ ] http://localhost:3400/api/docs shows Swagger UI
- [ ] Can create account via `/api/v1/auth/signup`
- [ ] Can login via `/api/v1/auth/login`
- [ ] Can fetch categories via `/api/v1/categories`

### ✅ Frontend Web

- [ ] http://localhost:3401 loads home page
- [ ] Can navigate to login/signup
- [ ] Search bar is functional
- [ ] Listings display
- [ ] Can navigate to admin portal (if admin user)

### ✅ Database

- [ ] PostgreSQL container running
- [ ] Can connect via Prisma Studio
- [ ] Tables created (45+ tables)
- [ ] Seed data loaded

### ✅ Redis

- [ ] Redis container running
- [ ] Can connect from API
- [ ] Caching works

## 🚦 Status Indicators

### All Green = Ready to Develop

```
✓ Node.js: v20+
✓ pnpm: v10+
✓ Docker: Running
✓ PostgreSQL: Healthy
✓ Redis: Healthy
✓ API: Running on 3400
✓ Web: Running on 3401
✓ Tests: 240+ passing
```

### Some Yellow = Review Warnings

```
✓ Core services running
⚠ Elasticsearch not running (optional)
⚠ Stripe keys not configured
⚠ Email service not configured
```

### Any Red = Fix Before Proceeding

```
✗ Database connection failed
✗ Dependencies not installed
✗ .env file missing
```

## 🔗 Quick Links

- **API**: http://localhost:3400
- **API Docs**: http://localhost:3400/api/docs
- **Web App**: http://localhost:3401
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

## 📚 Next Steps

After getting everything running:

1. **Read**: [PROJECT_REVIEW_SUMMARY.md](./PROJECT_REVIEW_SUMMARY.md)
2. **Follow**: [COMPREHENSIVE_VALIDATION_PLAN.md](./COMPREHENSIVE_VALIDATION_PLAN.md)
3. **Track**: [IMPLEMENTATION_STATUS_TRACKER.md](./IMPLEMENTATION_STATUS_TRACKER.md)
4. **Configure**: [EXTERNAL_SERVICES_SETUP.md](./EXTERNAL_SERVICES_SETUP.md)

## 🆘 Need Help?

1. Check existing documentation in project root
2. Review error logs in terminal
3. Check Docker logs: `docker-compose logs -f`
4. Verify .env file has correct values

## 💪 You're Ready!

If all services are running and tests pass, you're ready to:

- Develop new features
- Fix bugs
- Run tests
- Deploy to production

**Happy coding! 🎉**
