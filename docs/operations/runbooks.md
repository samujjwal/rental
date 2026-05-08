---
status: canonical
owner: operations
last_reviewed: 2026-05-08
source_of_truth: true
---

# Runbooks

This is the canonical home for operational response procedures.

## Incident Response Targets

| Severity | Response Target | Escalation Target |
| --- | --- | --- |
| P0 | 5 minutes | 15 minutes |
| P1 | 15 minutes | 30 minutes |
| P2 | 1 hour | 4 hours |
| P3 | 4 hours | next business day |

## First Response Checklist

1. Acknowledge the alert.
2. Open the incident communication channel.
3. Record the service, impact, start time, and suspected blast radius.
4. Check dashboards, health endpoints, and recent deploy activity.
5. Decide whether the fastest safe action is rollback, mitigation, or deeper diagnosis.

## Common Incident Classes

- API latency spikes
- database connection or query exhaustion
- payment path failures
- notification delivery issues
- degraded external dependency behavior
- deployment-related regressions

## Operational Rules

- capture every meaningful mitigation in the incident thread
- prefer rollback over speculative live patching when customer impact is active
- create follow-up remediation work for recurring failure modes
- keep command examples and dashboard references current as infrastructure evolves

## Service Management

### Start/Stop Services

```bash
# Start development environment
pnpm dev

# Start individual services
pnpm dev:api      # API server only
pnpm dev:web      # Web app only

# Stop services
pnpm env:stop dev stop

# Restart services
pnpm env:restart dev restart
```

### Check Service Status

```bash
# Check status
pnpm env:status dev status

# View logs
pnpm env:logs dev logs

# Health checks
curl https://yourdomain.com/api/health
curl https://yourdomain.com
```

## Database Operations

### Generate Prisma Client

After schema changes:
```bash
pnpm db:generate
```

### Run Migrations

```bash
# Apply migrations
pnpm db:migrate

# View migration status
pnpm --filter @rental-portal/database run migrate:status

# Resolve migration (rollback)
pnpm --filter @rental-portal/database migrate resolve <migration-name>
```

### Database Backup

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD.sql

# Automated backup (crontab)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

### Open Prisma Studio

```bash
pnpm db:studio
```

## Deployment Operations

### Pre-Deployment Checklist

1. Validate build: `pnpm validate`
2. Run all tests: `pnpm test:all`
3. Check security: `pnpm test:security`
4. Run guardrails: `pnpm guardrails`

### Deploy to Production

```bash
pnpm deploy
```

This will:
- Create backup
- Run migrations
- Deploy new version
- Verify health checks
- Rollback on failure

### Manual Deployment Steps

If automatic deployment fails:

1. Create backup: `pnpm backup`
2. SSH to server
3. Pull latest code: `git pull origin main`
4. Install dependencies: `pnpm install --frozen-lockfile`
5. Run migrations: `pnpm db:migrate`
6. Build: `pnpm build`
7. Restart services

### Rolling Update

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

### Rollback Procedures

```bash
# View previous images
docker images | grep rental

# Rollback to previous version
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Rollback database
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate resolve
```

## Troubleshooting

### Port Conflicts

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Reset database connection
pnpm env:stop dev stop
pnpm db:generate
pnpm env:start dev start
```

### Docker Issues

```bash
# Check Docker is running
docker info

# Clean up Docker resources
docker system prune -a
```

### Clean Everything

```bash
# Stop all environments
pnpm env:stop dev stop
pnpm env:stop test stop

# Clean build artifacts
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Regenerate Prisma client
pnpm db:generate
```

## Monitoring

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

## Related Docs

- [`slo.md`](slo.md)
- [`../engineering/deployment.md`](../engineering/deployment.md)
- [`../engineering/developer-guide.md`](../engineering/developer-guide.md)
