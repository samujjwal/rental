# Service Level Objectives (SLO) — Rental Portal

> **Revision**: 2026-03-21 (Cycle 7)  
> **Owner**: Platform Team (@rental/platform-team)  
> **Review cadence**: Quarterly; re-baselining after every major release

---

## 1. SLO Philosophy

Each SLO defines a **threshold**, an **error budget** (% of requests/time that may fail), and an associated **burn rate** alert that pages on-call before the budget is exhausted.

- **SLI** (indicator): the metric being measured  
- **SLO** (objective): the target threshold  
- **Error budget**: `1 - SLO target` — how much failure is acceptable per window  
- **Burn rate**: how fast error budget is being consumed vs. the 30-day window  

Alerts fire when the error budget is on track to be exhausted in less than the stated time window.

---

## 2. Availability SLOs

| Service | SLI | SLO Target | Error Budget | Measurement Window |
| --- | --- | --- | --- | --- |
| API (`/api/**`) | HTTP success rate (2xx / total non-4xx) | **99.5%** | 0.5% (≈ 3.6 h/month) | Rolling 30 days |
| Listings search (`/api/listings`) | HTTP success rate | **99.5%** | 0.5% | Rolling 30 days |
| Booking creation (`/api/bookings`) | HTTP success rate | **99.9%** | 0.1% (≈ 43 min/month) | Rolling 30 days |
| Payment initiation (`/api/payments`) | HTTP success rate | **99.9%** | 0.1% | Rolling 30 days |
| Auth endpoints (`/api/auth/**`) | HTTP success rate | **99.5%** | 0.5% | Rolling 30 days |
| AI endpoints (`/api/ai/**`) | HTTP success rate (provider errors excluded) | **99.0%** | 1.0% | Rolling 30 days |
| Web app (root page) | Uptime (synthetic probe, 1-min interval) | **99.5%** | 0.5% | Rolling 30 days |

---

## 3. Latency SLOs

| Service | Percentile | SLO Threshold | Measurement Window |
| --- | --- | --- | --- |
| API (all endpoints) | p95 | **< 500 ms** | Rolling 24 hours |
| API (all endpoints) | p99 | **< 1 000 ms** | Rolling 24 hours |
| Listings search | p95 | **< 400 ms** | Rolling 24 hours |
| Listing detail | p95 | **< 300 ms** | Rolling 24 hours |
| Booking create | p95 | **< 800 ms** | Rolling 24 hours |
| Auth login | p95 | **< 500 ms** | Rolling 24 hours |
| AI generate-description | p95 | **< 8 000 ms** | Rolling 24 hours |
| AI market-insights | p95 | **< 4 000 ms** | Rolling 24 hours |

---

## 4. Error Budget Policy

| Budget consumed | Action |
| --- | --- |
| < 50% | No action; monitor normally |
| 50–75% | Engineering team review; identify contributing factors |
| 75–90% | Incident review; freeze non-critical changes; focus on reliability |
| > 90% | Declare SLO breach; mandatory post-mortem within 48 h; all-hands reliability sprint |

---

## 5. Burn Rate Alerts

Burn rate = actual error rate ÷ SLO-implied error rate  
A burn rate of **1.0** means error budget is being consumed at exactly the sustainable rate.

| Alert Name | Burn Rate | Short Window | Long Window | Severity | Action |
| --- | --- | --- | --- | --- | --- |
| `api_availability_fast_burn` | ≥ 14.4× | 1 h | 5 min | **Page** (P1) | Immediate investigation |
| `api_availability_slow_burn` | ≥ 6× | 6 h | 30 min | **Alert** (P2) | Next-business-hour review |
| `booking_availability_fast_burn` | ≥ 14.4× | 1 h | 5 min | **Page** (P1) | Immediate investigation |
| `payment_availability_fast_burn` | ≥ 14.4× | 1 h | 5 min | **Page** (P1) | Immediate investigation |
| `api_latency_p95_breach` | — | p95 > 500 ms for 5 min | — | **Alert** (P2) | Engineering review |
| `ai_latency_p95_breach` | — | p95 > 8 000 ms for 10 min | — | **Alert** (P2) | Check provider; cache hit rate |

### Prometheus / Alertmanager rule snippet

```yaml
# api_availability_fast_burn
- alert: ApiAvailabilityFastBurn
  expr: |
    (
      rate(http_requests_total{job="api",code!~"4.."}[5m]) /
      rate(http_requests_total{job="api"}[5m])
    ) < 0.9928  # 14.4× burn of 0.5% budget
  for: 5m
  labels:
    severity: page
  annotations:
    summary: "API availability fast burn — SLO breach imminent"
    description: "Error rate suggests full 30-day budget consumed in < 2 hours"

# api_latency_p95_breach
- alert: ApiLatencyP95Breach
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="api"}[5m])) > 0.5
  for: 5m
  labels:
    severity: alert
  annotations:
    summary: "API p95 latency exceeds 500 ms SLO"
```

---

## 6. Load Test Baseline Thresholds

These thresholds are the **source of truth** for all k6 load test `thresholds` stanzas.  
Any divergence between a load test file and this table is a defect.

| Metric | Threshold | k6 expression |
| --- | --- | --- |
| `http_req_duration` p95 | < 500 ms | `p(95)<500` |
| `http_req_duration` p99 | < 1 000 ms | `p(99)<1000` |
| `http_req_failed` | < 1% | `rate<0.01` |
| `search_latency` p95 | < 400 ms | `p(95)<400` |
| `listing_latency` p95 | < 300 ms | `p(95)<300` |
| `booking_latency` p95 | < 800 ms | `p(95)<800` |
| `auth_latency` p95 | < 500 ms | `p(95)<500` |
| `ai_latency` p95 | < 8 000 ms | `p(95)<8000` |
| `failed_checks` | < 2% | `rate<0.02` |

---

## 7. Synthetic Monitoring

| Probe | URL | Frequency | Alert if down for |
| --- | --- | --- | --- |
| Web homepage | `https://app.rental-portal.com/` | 1 min | 2 consecutive failures |
| API health | `https://api.rental-portal.com/api/health` | 30 s | 2 consecutive failures |
| Listings search | `https://api.rental-portal.com/api/listings?limit=1` | 5 min | 1 failure |

---

## 8. Review and Escalation

| Role | Responsibility |
| --- | --- |
| On-call engineer | First responder for P1 pages; follows runbooks in `docs/RUNBOOKS.md` |
| Platform team lead | Owns SLO definitions; approves threshold changes |
| Engineering manager | Declares SLO breach; initiates post-mortem process |
| All engineers | Error-budget spending is a shared responsibility; PRs with >5% error-budget risk require EM approval |

---

## 9. SLO History

| Date | Change | Rationale |
| --- | --- | --- |
| 2026-03-21 | Initial SLO definitions established (Cycle 7) | First formal SLO document; baselines derived from k6 load test results and runbook thresholds |
