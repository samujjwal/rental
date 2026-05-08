# Production Release Checklist

This document provides a comprehensive checklist for production releases. The CI pipeline automatically generates this checklist on each main branch push.

## Automated Checks (CI/CD)

The following checks are automatically run by the production readiness gate:

### Code Quality
- ✅ Test coverage meets threshold (80%+)
- ✅ No hardcoded secrets in code
- ✅ No console.log statements in production code
- ✅ TypeScript compilation successful
- ✅ Linting passes
- ✅ No direct Prisma access in controllers

### Security
- ✅ Dependency security audit (moderate threshold)
- ✅ No TODO/FIXME comments exceeding threshold

## Manual Pre-Release Checks

### Functional Verification
- [ ] All tests passing (unit, integration, E2E)
- [ ] Authentication flows working
- [ ] Booking flow end-to-end working
- [ ] Payment integration (Stripe) working in test mode
- [ ] Email/SMS notifications configured
- [ ] File upload/download working
- [ ] Real-time messaging (WebSocket) working
- [ ] Admin dashboard functional

### Performance Verification
- [ ] Load tests passing (k6)
- [ ] Database query performance acceptable
- [ ] API response times within SLA
- [ ] No memory leaks detected

### Security Verification
- [ ] Rate limiting configured
- [ ] CORS configuration correct
- [ ] Authentication middleware active
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

### Infrastructure Verification
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis cache configured
- [ ] CDN configured for static assets
- [ ] SSL certificates valid
- [ ] Backup procedures tested

### Monitoring & Observability
- [ ] Logging configured
- [ ] Error tracking (Sentry) configured
- [ ] Metrics collection enabled
- [ ] Health check endpoints working
- [ ] Alert rules configured

### Documentation
- [ ] API documentation updated
- [ ] Release notes prepared
- [ ] Runbooks updated
- [ ] On-call team notified

## Rollback Plan

### Pre-Release
- [ ] Database backup taken
- [ ] Rollback procedure documented
- [ ] Rollback tested in staging
- [ ] Team trained on rollback

### Post-Release Verification
- [ ] Smoke tests passed
- [ ] Critical user journeys tested
- [ ] Error rates monitored
- [ ] Performance metrics checked
- [ ] User feedback monitored

## Release Process

### 1. Pre-Release
1. Create release branch from `develop`
2. Run full test suite: `pnpm run test:all`
3. Run security audit: `pnpm audit`
4. Review automated CI/CD checks
5. Complete manual checklist above

### 2. Release
1. Merge release branch to `main`
2. CI/CD pipeline runs production readiness gate
3. Deploy to staging environment
4. Run smoke tests on staging
5. Get approval from stakeholders

### 3. Production Deployment
1. Deploy to production
2. Monitor health check endpoints
3. Verify critical user journeys
4. Monitor error rates and performance
5. Notify team of successful deployment

### 4. Post-Release
1. Monitor for 24-48 hours
2. Address any issues immediately
3. Document any incidents
5. Update runbooks if needed

## Emergency Rollback Procedure

If critical issues are detected post-release:

1. **Immediate Assessment**
   - Identify the scope and impact of the issue
   - Determine if rollback is necessary
   - Notify stakeholders

2. **Rollback Execution**
   - Execute database rollback if needed
   - Revert to previous application version
   - Verify rollback success

3. **Post-Rollback**
   - Investigate root cause
   - Fix the issue
   - Test thoroughly
   - Redeploy with additional safeguards

## Version Numbering

Follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

Example: `1.2.3` → `1.2.4` (patch), `1.3.0` (minor), `2.0.0` (major)

## Release Notes Template

```markdown
# Release X.Y.Z

## New Features
- Feature 1 description
- Feature 2 description

## Bug Fixes
- Bug fix 1 description
- Bug fix 2 description

## Breaking Changes
- Breaking change 1 description
- Migration instructions if needed

## Performance Improvements
- Improvement 1 description

## Security Updates
- Security fix 1 description

## Known Issues
- Known issue 1 description
```

## Contact Information

- **Release Manager**: [Name]
- **On-Call Engineer**: [Name]
- **Emergency Contact**: [Phone/Slack]
