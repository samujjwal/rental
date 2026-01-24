# Security Testing Documentation

## Overview

This directory contains security testing configurations and scripts for the Universal Rental Portal API. These tests help identify and fix security vulnerabilities following OWASP best practices.

## Tools

### 1. OWASP ZAP (Zed Attack Proxy)

Comprehensive security scanner for web applications and APIs.

### 2. Quick Security Tests

Fast shell-based tests for common vulnerabilities.

## Quick Start

### Prerequisites

**Install OWASP ZAP**:

macOS:

```bash
brew install --cask owasp-zap
```

Linux:

```bash
# Download from https://www.zaproxy.org/download/
wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2.14.0_Linux.tar.gz
tar -xvf ZAP_2.14.0_Linux.tar.gz
```

**Install ZAP CLI**:

```bash
pip install zapcli
```

### Running Quick Security Tests

The quick test script checks common vulnerabilities in ~2 minutes:

```bash
# Make script executable
chmod +x test/security/quick-security-test.sh

# Run quick tests
./test/security/quick-security-test.sh
```

**Tests include**:

- SQL Injection
- Cross-Site Scripting (XSS)
- Authentication bypass
- Authorization issues
- Rate limiting
- CORS configuration
- Security headers
- Input validation
- Information disclosure
- Password policies

### Running Full OWASP ZAP Scan

Comprehensive scan (10-30 minutes):

```bash
# Make script executable
chmod +x test/security/zap-scan.sh

# Ensure API is running
npm run start:dev

# Run ZAP scan
./test/security/zap-scan.sh
```

**Custom API URL**:

```bash
API_URL=https://staging.example.com ./test/security/zap-scan.sh
```

**Custom ZAP port**:

```bash
ZAP_PORT=8091 ./test/security/zap-scan.sh
```

## Security Test Coverage

### OWASP Top 10 (2021)

| Risk | Category                    | Coverage                                    |
| ---- | --------------------------- | ------------------------------------------- |
| A01  | Broken Access Control       | ✅ Auth tests, authorization tests          |
| A02  | Cryptographic Failures      | ✅ HTTPS, password hashing, JWT             |
| A03  | Injection                   | ✅ SQL injection, command injection tests   |
| A04  | Insecure Design             | ✅ Rate limiting, input validation          |
| A05  | Security Misconfiguration   | ✅ Headers, CORS, error messages            |
| A06  | Vulnerable Components       | ⚠️ Manual review required                   |
| A07  | Authentication Failures     | ✅ Password policy, MFA, session management |
| A08  | Software & Data Integrity   | ✅ Input validation, file upload checks     |
| A09  | Security Logging Failures   | ✅ Audit logging implemented                |
| A10  | Server-Side Request Forgery | ✅ URL validation tests                     |

### Additional Security Tests

- **Rate Limiting**: API throttling protection
- **CORS**: Cross-origin resource sharing configuration
- **CSP**: Content Security Policy headers
- **XSS**: Cross-site scripting prevention
- **CSRF**: Cross-site request forgery tokens
- **File Upload**: Malicious file detection
- **Session Management**: Secure cookie handling
- **Information Disclosure**: Error message sanitization

## ZAP Configuration

The `zap-config.yaml` file contains:

### Context Configuration

- **API Endpoints**: All `/api/v1/*` paths
- **Authentication**: JWT-based login
- **Session Management**: Cookie-based sessions
- **Test Users**: Renter, Owner, Admin roles

### Active Scanners

- **Attack Strength**: HIGH for critical vulnerabilities
- **Threshold**: MEDIUM for balanced detection
- **Coverage**: 100+ vulnerability checks

### Spider Configuration

- **Max Depth**: 5 levels
- **Duration**: 10 minutes
- **Thread Count**: 5 concurrent threads
- **Form Handling**: Enabled

### Exclusions

- Health check endpoints
- Static assets (CSS, JS, images)
- Documentation endpoints

## Interpreting Results

### Risk Levels

| Risk              | Severity               | Action Required                   |
| ----------------- | ---------------------- | --------------------------------- |
| **High**          | Critical security flaw | Fix immediately before production |
| **Medium**        | Moderate vulnerability | Fix before release                |
| **Low**           | Minor issue            | Address in next sprint            |
| **Informational** | Best practice          | Consider implementing             |

### Common Findings

#### High Risk Alerts

**SQL Injection**:

- **Impact**: Database compromise, data theft
- **Fix**: Use parameterized queries, ORMs (Prisma)
- **Verification**: Test with single quotes, OR statements

**Cross-Site Scripting (XSS)**:

- **Impact**: Session hijacking, credential theft
- **Fix**: Sanitize all user input, use CSP headers
- **Verification**: Test with `<script>` tags

**Authentication Bypass**:

- **Impact**: Unauthorized access
- **Fix**: Verify JWT tokens, implement RBAC
- **Verification**: Test with missing/invalid tokens

#### Medium Risk Alerts

**Missing Security Headers**:

- **Impact**: Various attacks possible
- **Fix**: Add Helmet middleware
- **Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, CSP

**Weak Password Policy**:

- **Impact**: Brute force attacks
- **Fix**: Enforce minimum length, complexity requirements
- **Verification**: Test with "password123"

**Information Disclosure**:

- **Impact**: Leak sensitive data
- **Fix**: Generic error messages, remove stack traces
- **Verification**: Trigger errors, check responses

#### Low Risk Alerts

**Cookie Without Secure Flag**:

- **Impact**: Cookie interception on HTTP
- **Fix**: Set `secure: true` in cookie options
- **Verification**: Test over HTTP vs HTTPS

**Missing CSP Header**:

- **Impact**: XSS attacks easier
- **Fix**: Implement Content-Security-Policy
- **Verification**: Check response headers

## Remediation Guide

### 1. SQL Injection

**Current Implementation** (Safe):

```typescript
// Using Prisma ORM - automatically prevents SQL injection
await prisma.listing.findMany({
  where: {
    title: { contains: searchQuery }, // Safe parameterized query
  },
});
```

**Anti-Pattern** (Vulnerable):

```typescript
// Never do this - vulnerable to SQL injection
await prisma.$queryRawUnsafe(`SELECT * FROM listings WHERE title LIKE '%${searchQuery}%'`);
```

### 2. XSS Prevention

**Current Implementation**:

```typescript
// Input validation with class-validator
@IsString()
@MaxLength(100)
@Transform(({ value }) => sanitizeHtml(value))
title: string;
```

**Security Headers** (Helmet):

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
  }),
);
```

### 3. Authentication

**Current Implementation**:

```typescript
// JWT validation with guards
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
async updateListing() {
  // Protected endpoint
}
```

### 4. Rate Limiting

**Current Implementation**:

```typescript
// ThrottlerModule configured
@ThrottlerModule.forRoot([{
  ttl: 60000, // 1 minute
  limit: 10, // 10 requests
}])
```

### 5. CORS Configuration

**Current Implementation**:

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  security-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Run quick security tests
        run: |
          chmod +x test/security/quick-security-test.sh
          ./test/security/quick-security-test.sh

      - name: Install ZAP
        run: |
          pip install zapcli
          wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2.14.0_Linux.tar.gz
          tar -xvf ZAP_2.14.0_Linux.tar.gz

      - name: Run ZAP scan
        run: |
          chmod +x test/security/zap-scan.sh
          ./test/security/zap-scan.sh

      - name: Upload ZAP report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: zap-report
          path: test/security/reports/

      - name: Check for high-risk issues
        run: |
          if [ -f test/security/reports/latest.json ]; then
            HIGH_RISK=$(jq '[.site[].alerts[] | select(.risk == "High")] | length' test/security/reports/latest.json)
            if [ $HIGH_RISK -gt 0 ]; then
              echo "Found $HIGH_RISK high-risk security issues!"
              exit 1
            fi
          fi
```

### Automated Remediation

**Dependabot** for vulnerable dependencies:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'daily'
    open-pull-requests-limit: 10
```

**Snyk** integration:

```bash
# Install Snyk
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

## Best Practices

### 1. Regular Scanning

- Run quick tests on every PR
- Run full ZAP scan weekly
- Schedule monthly penetration testing

### 2. Vulnerability Management

- Triage findings within 24 hours
- Fix high-risk issues before deployment
- Track remediation in issue tracker

### 3. Security Headers

Always include:

- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Content-Security-Policy`
- `X-XSS-Protection`

### 4. Input Validation

- Validate all user input
- Sanitize before storage
- Escape before display
- Use allowlists over denylists

### 5. Authentication

- Use strong password hashing (bcrypt)
- Implement rate limiting on login
- Enable MFA for sensitive accounts
- Rotate JWT secrets regularly

### 6. Error Handling

- Never expose stack traces
- Use generic error messages
- Log detailed errors server-side
- Sanitize error responses

## Troubleshooting

### ZAP Fails to Start

```bash
# Check if ZAP is already running
ps aux | grep zap

# Kill existing ZAP processes
pkill -9 -f zap

# Try again
./test/security/zap-scan.sh
```

### API Not Responding

```bash
# Check if API is running
curl http://localhost:3000/api/v1/health

# Check logs
docker-compose logs api

# Restart API
npm run start:dev
```

### Too Many False Positives

Edit `zap-config.yaml` to:

- Reduce scanner sensitivity
- Add more exclusions
- Adjust thresholds

### Rate Limiting Blocks Scan

Temporarily increase limits during scan:

```typescript
// In test environment only
@ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 1000, // Increased for security testing
}])
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Support

For security concerns:

- **Internal**: Contact security team
- **External**: security@rentals-portal.com
- **Vulnerabilities**: Follow responsible disclosure policy
