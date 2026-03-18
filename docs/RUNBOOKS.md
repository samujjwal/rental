# On-Call Runbooks
## GharBatai Nepal Rental Portal - Operations Manual

---

## Quick Reference Card

| Severity | Response Time | Escalation | Contact |
|----------|----------------|------------|---------|
| **P0 - Critical** | 5 minutes | 15 minutes | On-call engineer → Engineering Manager → CTO |
| **P1 - High** | 15 minutes | 30 minutes | On-call engineer → Team Lead |
| **P2 - Medium** | 1 hour | 4 hours | On-call engineer |
| **P3 - Low** | 4 hours | 24 hours | Next business day |

**PagerDuty Rotation**: [Link to PagerDuty]
**Slack Channel**: #incidents-gharbatai
**War Room**: [Meet/Zoom link]

---

## Table of Contents

1. [Alert Response Procedures](#alert-response-procedures)
2. [Common Incidents](#common-incidents)
3. [Service-Specific Runbooks](#service-specific-runbooks)
4. [Escalation Procedures](#escalation-procedures)
5. [Post-Incident Process](#post-incident-process)

---

## Alert Response Procedures

### Initial Response (First 5 Minutes)

1. **Acknowledge the alert** in PagerDuty
2. **Join #incidents-gharbatai** Slack channel
3. **Create incident thread** with format:
   ```
   🚨 [SEVERITY] Brief description
   - Alert: [Alert name]
   - Time: [Timestamp]
   - Service: [Affected service]
   - Impact: [User/transaction impact]
   ```
4. **Check dashboards**:
   - [Grafana - System Overview](link)
   - [Datadog - API Performance](link)
   - [Stripe Dashboard](link) (for payment issues)

### Assessment Checklist

- [ ] What service(s) are affected?
- [ ] How many users are impacted?
- [ ] Is there revenue impact?
- [ ] Is data at risk?
- [ ] Can the issue be mitigated quickly?

---

## Common Incidents

### 1. API Latency Spike

**Alert**: `api_p95_latency > 500ms`
**Severity**: P1

#### Diagnosis
```bash
# Check recent deployments
kubectl get pods -n api --sort-by=.metadata.creationTimestamp

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start;"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### Common Causes & Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| N+1 queries | Spike in DB connections | Add `include` to Prisma queries |
| Missing index | Seq scan in logs | Create index (see Index Runbook) |
| Cache stampede | Redis CPU spike | Enable cache warming |
| External API slow | Timeout errors | Enable circuit breaker |

#### Rollback Procedure
```bash
# If recent deployment is suspect
kubectl rollout undo deployment/api -n api

# Verify rollback
kubectl rollout status deployment/api -n api
```

---

### 2. Database Connection Pool Exhaustion

**Alert**: `db_connection_pool_usage > 80%`
**Severity**: P0

#### Immediate Actions
```bash
# 1. Check current connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 2. Identify long-running queries
psql $DATABASE_URL -c "SELECT pid, query_start, query FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - interval '5 minutes';"

# 3. If necessary, terminate long queries (use with caution!)
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - interval '10 minutes';"
```

#### Connection Pool Tuning
```typescript
// apps/api/src/common/prisma/prisma.service.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Increase pool size temporarily
  connectionLimit: 50, // Default is 10
});
```

---

### 3. Payment Processing Failure

**Alert**: `payment_success_rate < 95%`
**Severity**: P0

#### Immediate Checks

1. **Stripe Status**: https://status.stripe.com/
2. **Webhook delivery**: Stripe Dashboard → Developers → Webhooks
3. **Failed payments**: Stripe Dashboard → Payments → Filter by "Failed"

#### Diagnostic Commands
```bash
# Check webhook processor logs
kubectl logs -n api -l app=api --tail=1000 | grep "webhook\|payment"

# Check dead letter queue
kubectl exec -it redis-master-0 -- redis-cli LLEN stripe:deadletter

# Review failed webhooks
kubectl exec -it redis-master-0 -- redis-cli LRANGE stripe:deadletter 0 10
```

#### Recovery Procedures

**Webhook Replay**:
```bash
# Access API pod
kubectl exec -it deployment/api -n api -- /bin/sh

# Replay dead letter events
node scripts/replay-webhooks.js --limit=100
```

**Payment Reconciliation**:
```bash
# Check for stuck payments
psql $DATABASE_URL -c "SELECT id, status, created_at FROM payments WHERE status = 'PENDING' AND created_at < NOW() - interval '1 hour';"

# Manual status sync (if Stripe shows succeeded but DB shows pending)
node scripts/sync-payment-status.js --booking-id=<id>
```

---

### 4. Search Unavailable

**Alert**: `search_error_rate > 1%`
**Severity**: P1

#### Quick Fix
```bash
# Clear search cache (forces fallback)
kubectl exec -it redis-master-0 -- redis-cli --scan --pattern "search:*" | xargs -L 100 redis-cli DEL

# Restart search service if needed
kubectl rollout restart deployment/api -n api
```

#### Fallback Mode
If search is down, listings page shows "Popular listings" instead of search results. This is automatic.

---

### 5. Redis Outage

**Alert**: `redis_connection_failures`
**Severity**: P1

#### Impact Assessment
- Sessions will fail (users logged out)
- Cache misses increase DB load
- Rate limiting disabled
- Webhook idempotency affected

#### Recovery
```bash
# Check Redis pods
kubectl get pods -n redis

# Check logs
kubectl logs -n redis redis-master-0 --tail=500

# If cluster mode
kubectl exec -it redis-cluster-0 -- redis-cli cluster info
```

#### Service Degradation
All services have Redis failure fallbacks:
- Cache: Direct DB queries (slower but functional)
- Sessions: Fail open (users need to re-login)
- Rate limiting: Disabled
- Webhooks: Process anyway (DB constraints prevent dupes)

---

## Service-Specific Runbooks

### API Service

**Health Check**: `GET /health`
**Metrics**: `GET /metrics` (Prometheus)

#### Common Issues

**Memory Leak**:
```bash
# Check memory usage
kubectl top pods -n api

# Profile memory (if needed)
kubectl exec -it deployment/api -- node --inspect scripts/profile-memory.js

# Restart as last resort
kubectl rollout restart deployment/api -n api
```

**CPU Spike**:
```bash
# Find high CPU pods
kubectl top pods -n api --sort-by=cpu

# Check for infinite loops in logs
kubectl logs -n api -l app=api | grep -i "error\|exception" | tail -100
```

---

### Database

**Connection String**: See `DATABASE_URL` in secrets
**Backup Location**: `s3://gharbatai-backups/postgres/`

#### Backup Verification
```bash
# Latest backup
aws s3 ls s3://gharbatai-backups/postgres/ | tail -5

# Test restore (staging only)
./scripts/restore-backup.sh --source=s3://gharbatai-backups/postgres/latest.sql.gz --target=staging
```

#### Point-in-Time Recovery
```bash
# If needed, restore to specific time
./scripts/pitr-restore.sh --timestamp="2026-03-16T10:00:00Z"
```

---

### Web Frontend

**Health Check**: `GET /health`
**CDN**: CloudFlare

#### Issue: 500 Errors
```bash
# Check logs
kubectl logs -n web deployment/web --tail=500

# Recent deployments
kubectl get pods -n web --sort-by=.metadata.creationTimestamp
```

#### Issue: Static Assets Not Loading
```bash
# Purge CloudFlare cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

### Mobile API

**Health Check**: Same as API (`/health`)

#### Issue: App Crashes on Launch
- Check for forced upgrade requirement
- Verify API version compatibility
- Check for feature flag issues

---

## Escalation Procedures

### P0 (Critical) - Revenue or Data at Risk

1. **0-5 min**: On-call engineer acknowledges, begins diagnosis
2. **5-15 min**: If unresolved, page Engineering Manager
3. **15-30 min**: If unresolved, all-hands in war room
4. **Continuous**: Post to #incidents-gharbatai every 15 min

### P1 (High) - Major Feature Degraded

1. **0-15 min**: On-call engineer diagnoses
2. **15-30 min**: If unresolved, escalate to Team Lead
3. **30+ min**: War room if still unresolved

### Communication Templates

**Initial Alert**:
```
🚨 P0 Incident: [Brief description]
Impact: [X users affected / $Y revenue at risk]
Started: [Timestamp]
Actions: [What we're doing]
ETA: [Estimated resolution]

Thread for updates 👇
```

**Status Update (Every 15 min for P0)**:
```
📊 Update [Timestamp]
Status: [Improving/Stable/Worsening]
Actions taken: [List]
Next steps: [List]
ETA update: [New estimate]
```

**All Clear**:
```
✅ Resolved: [Brief description]
Duration: [X minutes]
Root cause: [Summary]
Impact: [Final numbers]
Post-mortem: [Scheduled for when]
```

---

## Post-Incident Process

### Within 24 Hours
- [ ] Incident summary posted to #incidents-gharbatai
- [ ] Preliminary timeline documented
- [ ] User impact calculated
- [ ] Monitoring gaps identified

### Within 1 Week
- [ ] Post-mortem meeting scheduled
- [ ] Root cause analysis completed
- [ ] Action items assigned with owners
- [ ] Runbook updates if needed

### Post-Mortem Template
```markdown
# Post-Mortem: [Incident Title]
Date: [YYYY-MM-DD]
Severity: [P0/P1/P2/P3]
Duration: [X minutes]
On-call: [Name]

## Summary
One paragraph description

## Timeline
- HH:MM - Alert fired
- HH:MM - On-call acknowledged
- HH:MM - Issue identified
- HH:MM - Mitigation applied
- HH:MM - Resolved

## Root Cause
Detailed explanation

## Impact
- Users affected: X
- Revenue impact: $Y
- Data loss: Yes/No (details)

## Lessons Learned
1. What went well
2. What didn't go well
3. Lucky breaks

## Action Items
| Task | Owner | Due Date |
|------|-------|----------|
| Fix X | @person | YYYY-MM-DD |
| Add monitoring | @person | YYYY-MM-DD |
| Update runbook | @person | YYYY-MM-DD |
```

---

## Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Engineering Manager | [Name] | [Phone] | @[handle] |
| Infrastructure Lead | [Name] | [Phone] | @[handle] |
| Database Admin | [Name] | [Phone] | @[handle] |
| Security Lead | [Name] | [Phone] | @[handle] |
| Product Manager | [Name] | [Phone] | @[handle] |

**External Vendors**:
- Stripe: https://support.stripe.com/ or emergency@stripe.com
- AWS: Business support through console
- CloudFlare: support@cloudflare.com
- SendGrid: support@sendgrid.com

---

## Quick Command Reference

```bash
# View all pods
kubectl get pods -A

# View logs
kubectl logs -f deployment/api -n api

# Port forward for debugging
kubectl port-forward svc/api 3001:3000 -n api

# Database access
psql $DATABASE_URL

# Redis access
kubectl exec -it redis-master-0 -- redis-cli

# Check certificates
kubectl get certificates -A

# Scale deployments
kubectl scale deployment/api --replicas=5 -n api
```

---

## Appendix: Useful Queries

### Database Health
```sql
-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

-- Long-running transactions
SELECT pid, usename, application_name, state, xact_start, query_start, query
FROM pg_stat_activity WHERE state != 'idle' AND xact_start < NOW() - interval '5 minutes';
```

---

*Last Updated: March 16, 2026*
*Owner: Platform Engineering Team*
