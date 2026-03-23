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

## Related Docs

- [`slo.md`](slo.md)
- [`../engineering/deployment.md`](../engineering/deployment.md)
