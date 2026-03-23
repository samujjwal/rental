# Service Level Objectives

This is the canonical home for service-level objectives and error-budget policy.

## Availability Targets

| Service | Objective |
| --- | --- |
| API | 99.5% |
| Listings search | 99.5% |
| Booking creation | 99.9% |
| Payment initiation | 99.9% |
| Auth endpoints | 99.5% |
| AI endpoints | 99.0% |
| Web app synthetic uptime | 99.5% |

## Latency Targets

| Flow | Objective |
| --- | --- |
| API p95 | < 500 ms |
| API p99 | < 1 000 ms |
| Listings search p95 | < 400 ms |
| Listing detail p95 | < 300 ms |
| Booking create p95 | < 800 ms |
| Auth login p95 | < 500 ms |
| AI generate-description p95 | < 8 000 ms |
| AI market-insights p95 | < 4 000 ms |

## Error Budget Policy

- below 50% budget consumed: monitor normally
- 50-75%: investigate and review contributing factors
- 75-90%: prioritize reliability work and slow non-critical change
- above 90%: treat as SLO breach and run a post-incident reliability response

## Operational Guidance

- keep alert thresholds aligned with these objectives
- keep load-test thresholds consistent with these targets
- update this document only when objectives or policy materially change
