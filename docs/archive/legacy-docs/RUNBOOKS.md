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

*Last Updated: March 21, 2026*
*Owner: Platform Engineering Team*

---

## Backup & Restore Runbook

### RPO / RTO Targets
| Tier | RPO (data loss tolerance) | RTO (max time to restore) |
|------|--------------------------|--------------------------|
| Production database | 5 minutes (continuous WAL streaming) | 2 hours |
| Redis (session/cache) | Acceptable to lose (ephemeral) | 15 minutes |
| Object storage (MinIO/S3) | 24 hours (daily snapshots) | 4 hours |

### Full Backup Procedure
```bash
# 1. Trigger a manual database backup
./scripts/backup.sh --env production

# 2. Verify backup integrity
pg_restore --list $BACKUP_FILE | head -20

# 3. Confirm the backup is uploaded to offsite storage
aws s3 ls s3://$BACKUP_BUCKET/$(date +%Y/%m/%d)/ | tail -5
```

### Full Restore Procedure
```bash
# --- STOP TRAFFIC FIRST ---
# 1. Put the load balancer in maintenance mode (CloudFlare Page Rule or nginx 503)
# 2. Scale down application
kubectl scale deployment/api --replicas=0 -n api
kubectl scale deployment/web --replicas=0 -n web

# 3. Restore the database from the most recent backup
./scripts/backup.sh --restore --file $BACKUP_FILE --target $DATABASE_URL

# 4. Verify row counts match expected baseline
psql $DATABASE_URL -c "SELECT count(*) FROM users; SELECT count(*) FROM bookings;"

# 5. Run migration check (no pending migrations should be needed on restore)
pnpm --filter @rental-portal/database run migrate:status

# 6. Scale applications back up
kubectl scale deployment/api --replicas=3 -n api
kubectl scale deployment/web --replicas=2 -n web

# 7. Run smoke tests
curl -fsS https://api.rental.example.com/health
curl -fsS https://rental.example.com

# 8. Remove maintenance mode and monitor for 15 minutes
```

### Point-In-Time Recovery
```bash
# Recover to a specific timestamp (requires WAL archiving enabled)
./scripts/backup.sh --pitr --target-time "2026-03-21 14:00:00 UTC"
```

### Validation After Restore
- [ ] `/health` endpoint returns `200` with all services healthy
- [ ] A test booking creation succeeds end-to-end
- [ ] Stripe webhook test event is processed correctly
- [ ] Confirm no events in `event_store` are missing using aggregate version continuity check

---

## Disaster Recovery Runbook

### RTO: 4 hours | RPO: 5 minutes

### Full-Region Loss Scenario

**Step 1 — Detect**
- Alert fires: API health globally unreachable for > 2 minutes
- Confirm with status page of primary cloud provider (DigitalOcean / AWS region)

**Step 2 — Declare DR**
- Incident commander declares DR in `#incidents` Slack channel
- Page the on-call DBA and infrastructure lead

**Step 3 — Activate standby region**
```bash
# Provision backup region from IaC (if hot-standby already provisioned, skip to Step 4)
cd infra/
terraform workspace select dr-region
terraform apply -auto-approve

# Or use the DigitalOcean multi-region compose:
docker-compose -f docker-compose.multi-region.yml up -d --build
```

**Step 4 — Restore database in DR region**
```bash
# Pull latest backup from offsite S3-compatible bucket
aws s3 cp s3://$BACKUP_BUCKET/latest/backup.dump /tmp/restore.dump \
  --endpoint-url $BACKUP_S3_ENDPOINT

./scripts/backup.sh --restore --file /tmp/restore.dump --target $DR_DATABASE_URL
```

**Step 5 — Update DNS**
```bash
# Point primary domain to DR region (CloudFlare API)
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$CF_RECORD_ID" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"api.rental.example.com\",\"content\":\"$DR_IP\",\"ttl\":60,\"proxied\":true}"
```

**Step 6 — Validate**
- [ ] API health check passes in DR region
- [ ] Test login + booking creation
- [ ] Verify Stripe webhook endpoint is reachable
- [ ] Notify users via status page

**Step 7 — Post-DR cleanup**
- Once primary region is restored, replay any events that occurred in DR-only window
- Run data consistency check between primary and DR databases
- Restore DNS back to primary region after validation

### Communication Template — DR Declared
```
SUBJECT: [INCIDENT] Platform DR Mode Active — [TIME]
STATUS: We have activated our disaster recovery environment following [CAUSE].
IMPACT: Service is degraded / unavailable in [REGION].
ETA: We expect full restoration by [TIME].
UPDATES: Follow https://status.rental.example.com
```

---

## Horizontal Scaling Runbook

### When to Scale (Trigger Thresholds)
| Metric | Scale Up Threshold | Scale Down Threshold |
|--------|--------------------|----------------------|
| API CPU p95 | > 70% for 5 min | < 30% for 15 min |
| API memory | > 80% | < 40% for 15 min |
| DB connection pool | > 80% utilised | < 40% for 15 min |
| Queue depth (`bookings`) | > 500 messages | < 50 for 10 min |

### Scale Up Procedure
```bash
# API pods
kubectl scale deployment/api --replicas=8 -n api

# Verify pods are healthy before removing old ones
kubectl rollout status deployment/api -n api --timeout=5m

# Temporary DB connection pool bump if needed (env var, no restart required via config reload)
kubectl set env deployment/api DATABASE_POOL_MAX=25 -n api
```

### Scale Down Procedure
```bash
# Drain connections gracefully — scale down 1 replica at a time
kubectl scale deployment/api --replicas=$(( $(kubectl get deployment api -n api -o jsonpath='{.spec.replicas}') - 1 )) -n api
# Wait 60s, then repeat until at desired minimum
```

### After Scaling
- [ ] p95 API latency returns to baseline (< 500ms)
- [ ] No `503` errors in nginx access logs
- [ ] DB connection pool utilisation back below 60%

---

## Secrets Rotation Runbook

> **Rule**: Rotate all secrets when any team member with access to production secrets leaves, or on a 90-day schedule.

### Pre-rotation Checklist
- [ ] Notify on-call team 30 minutes before starting
- [ ] Ensure database backup was taken in the last 1 hour
- [ ] Have rollback plan ready (store old values for 24 hours before deletion)

### 1. JWT Secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
```bash
# Generate new secrets
NEW_JWT=$(openssl rand -hex 64)
NEW_REFRESH=$(openssl rand -hex 64)

# Update in secret manager / .env (do NOT commit to git)
# Kubernetes example:
kubectl create secret generic jwt-secrets \
  --from-literal=JWT_SECRET=$NEW_JWT \
  --from-literal=JWT_REFRESH_SECRET=$NEW_REFRESH \
  --dry-run=client -o yaml | kubectl apply -f -

# Rolling restart (graceful — existing sessions remain valid until token expiry)
kubectl rollout restart deployment/api -n api
```

### 2. Database Password (`DATABASE_URL`)
```bash
# 1. Add new password alongside old in PostgreSQL (dual-write window)
psql $DATABASE_URL -c "ALTER USER rental_app PASSWORD '$NEW_DB_PASS';"

# 2. Update application secret
kubectl patch secret db-credentials -n api \
  --patch '{"stringData":{"DATABASE_URL":"postgres://rental_app:'$NEW_DB_PASS'@db:5432/rental"}}'

# 3. Rolling restart
kubectl rollout restart deployment/api -n api

# 4. Verify connections established with new credentials
kubectl logs -l app=api --tail=20 | grep "DatabaseService"
```

### 3. Stripe Keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
```bash
# Roll in Stripe Dashboard → API Keys → Roll key
# Copy new restricted key, update webhook signing secret from Stripe Dashboard

kubectl patch secret stripe-credentials -n api \
  --patch '{"stringData":{"STRIPE_SECRET_KEY":"'$NEW_STRIPE_KEY'","STRIPE_WEBHOOK_SECRET":"'$NEW_WEBHOOK_SECRET'"}}'
kubectl rollout restart deployment/api -n api

# Send a test Stripe webhook event and confirm it is accepted (200 response)
stripe trigger payment_intent.succeeded
```

### 4. OpenAI API Key (`OPENAI_API_KEY`)
```bash
# 1. Create new key at platform.openai.com (do NOT delete old key yet)
# 2. Update in secrets manager
kubectl patch secret ai-credentials -n api \
  --patch '{"stringData":{"OPENAI_API_KEY":"'$NEW_OPENAI_KEY'"}}'
kubectl rollout restart deployment/api -n api

# 3. Verify AI features work (call /ai/generate-description endpoint)
curl -X POST https://api.rental.example.com/api/v1/ai/generate-description \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"title":"Test","category":"vehicle"}' | jq .fromProvider

# 4. After 24h with no errors, revoke old key in OpenAI dashboard
```

### 5. Field Encryption Key (`ENCRYPTION_KEY`)
> **Warning**: Rotating the encryption key requires re-encrypting all stored encrypted fields. This is a multi-step migration with downtime risk.
```bash
# 1. Set KEY_ROTATION_MODE=true — service will write new key, still read old key
kubectl set env deployment/api ENCRYPTION_KEY_NEW=$NEW_ENC_KEY KEY_ROTATION_MODE=true -n api

# 2. Run the re-encryption migration script
pnpm --filter @rental-portal/api run script:rotate-encryption-key

# 3. Verify encrypted fields are readable
pnpm --filter @rental-portal/api run script:verify-encryption

# 4. Remove old key and disable rotation mode
kubectl set env deployment/api ENCRYPTION_KEY=$NEW_ENC_KEY ENCRYPTION_KEY_OLD- KEY_ROTATION_MODE- -n api
```

---

## AI Provider Outage Runbook

### Detection
- Alert: `ai_completion_error_rate > 0.5` for 2 consecutive minutes
- Or: OpenAI status page shows incident at https://status.openai.com

### Immediate Actions
```bash
# 1. Check API logs for AI errors
kubectl logs -l app=api --tail=50 | grep '"ai.fromProvider":false\|OpenAI\|provider'

# 2. Verify the AI response cache hit rate (cached responses still serve)
# In Redis:
kubectl exec -it redis-master-0 -- redis-cli INFO stats | grep keyspace_hits

# 3. If cache hit rate is low, the product surface that is degraded:
#    - /ai/generate-description       → listing creation AI suggestions unavailable
#    - /ai/listing-suggestions        → suggestions panel shows "unavailable" state (by design)
#    - AI Concierge                   → concierge replies with template fallback
```

### If Outage Exceeds 30 Minutes
- [ ] Post status update on internal `#incidents` channel
- [ ] If a secondary AI provider adapter is configured, update `AI_PROVIDER` env var:
  ```bash
  kubectl set env deployment/api AI_PROVIDER=anthropic -n api
  kubectl rollout restart deployment/api -n api
  ```
- [ ] Notify product team that AI features are degraded (users see honest unavailable states — no mock data is returned)

### Recovery Validation
- Send a test `/ai/generate-description` request and confirm `fromProvider: true` in response
- Confirm `AiTelemetryInterceptor` logs show `ai.fromProvider: true`
- Check `ai_usage_ledger` for resumed entries
