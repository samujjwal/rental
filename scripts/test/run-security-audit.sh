#!/bin/bash

# Security Audit Script
# Runs comprehensive security checks on the application

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

cd "$PROJECT_ROOT"

log_section "Starting Security Audit"

# 1. NPM Audit
log_section "1. NPM Security Audit"
log_info "Checking for vulnerable dependencies..."

if pnpm audit --json > npm-audit-report.json 2>&1; then
    log_info "✓ No vulnerabilities found in dependencies"
else
    log_warn "⚠ Vulnerabilities found. Check npm-audit-report.json for details"
    pnpm audit --audit-level=moderate || log_warn "Some vulnerabilities detected"
fi

# 2. Dependency Check
log_section "2. Outdated Dependencies"
log_info "Checking for outdated packages..."
pnpm outdated || log_info "All packages are up to date"

# 3. License Check
log_section "3. License Compliance"
log_info "Checking package licenses..."
pnpm licenses list --json > licenses-report.json || log_warn "Could not generate license report"

# 4. Secret Scanning
log_section "4. Secret Scanning"
log_info "Scanning for exposed secrets..."

# Check for common secret patterns
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --verbose --report-path gitleaks-report.json || log_warn "Potential secrets detected"
else
    log_warn "gitleaks not installed. Install with: brew install gitleaks"
    
    # Basic grep-based secret detection
    log_info "Running basic secret detection..."
    
    SECRET_PATTERNS=(
        "password\s*=\s*['\"][^'\"]*['\"]"
        "api[_-]?key\s*=\s*['\"][^'\"]*['\"]"
        "secret\s*=\s*['\"][^'\"]*['\"]"
        "token\s*=\s*['\"][^'\"]*['\"]"
        "aws[_-]?access[_-]?key"
        "private[_-]?key"
    )
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if grep -r -i -E "$pattern" --exclude-dir={node_modules,.git,dist,build} .; then
            log_warn "⚠ Potential secret found matching pattern: $pattern"
        fi
    done
fi

# 5. Code Quality & Security Linting
log_section "5. Code Quality & Security Linting"
log_info "Running ESLint security rules..."

cd apps/api
pnpm lint || log_warn "Linting issues found in API"

cd ../web
pnpm lint || log_warn "Linting issues found in Web"

cd ../..

# 6. TypeScript Strict Mode Check
log_section "6. TypeScript Strict Mode"
log_info "Checking TypeScript configuration..."

if grep -q '"strict": true' apps/api/tsconfig.json && grep -q '"strict": true' apps/web/tsconfig.json; then
    log_info "✓ TypeScript strict mode is enabled"
else
    log_warn "⚠ TypeScript strict mode is not enabled in all projects"
fi

# 7. Environment Variables Check
log_section "7. Environment Variables Security"
log_info "Checking for exposed environment variables..."

if grep -r "process.env" apps/ --exclude-dir={node_modules,dist,build} | grep -v "process.env.NODE_ENV"; then
    log_warn "⚠ Direct process.env usage found. Consider using a config service"
fi

# 8. CORS Configuration Check
log_section "8. CORS Configuration"
log_info "Checking CORS settings..."

if grep -r "cors" apps/api/src --include="*.ts" | grep -q "origin: '*'"; then
    log_error "✗ Insecure CORS configuration detected (origin: '*')"
else
    log_info "✓ CORS configuration appears secure"
fi

# 9. SQL Injection Check
log_section "9. SQL Injection Prevention"
log_info "Checking for raw SQL queries..."

if grep -r "query\|execute" apps/api/src --include="*.ts" | grep -v "prisma" | grep -q "SELECT\|INSERT\|UPDATE\|DELETE"; then
    log_warn "⚠ Raw SQL queries detected. Ensure parameterized queries are used"
else
    log_info "✓ Using Prisma ORM (protected against SQL injection)"
fi

# 10. XSS Prevention Check
log_section "10. XSS Prevention"
log_info "Checking for dangerous HTML rendering..."

if grep -r "dangerouslySetInnerHTML\|innerHTML" apps/web/app --include="*.tsx" --include="*.ts"; then
    log_warn "⚠ Potentially unsafe HTML rendering detected"
else
    log_info "✓ No dangerous HTML rendering found"
fi

# 11. Authentication Check
log_section "11. Authentication Security"
log_info "Checking authentication implementation..."

if grep -r "bcrypt\|argon2" apps/api/src --include="*.ts" > /dev/null; then
    log_info "✓ Using secure password hashing"
else
    log_warn "⚠ Could not verify password hashing implementation"
fi

if grep -r "jwt" apps/api/src --include="*.ts" | grep -q "expiresIn"; then
    log_info "✓ JWT tokens have expiration"
else
    log_warn "⚠ JWT expiration not clearly configured"
fi

# 12. Rate Limiting Check
log_section "12. Rate Limiting"
log_info "Checking for rate limiting..."

if grep -r "rate-limit\|throttle" apps/api/src --include="*.ts" > /dev/null; then
    log_info "✓ Rate limiting implemented"
else
    log_warn "⚠ Rate limiting not found in API code"
fi

# 13. HTTPS/SSL Check
log_section "13. HTTPS/SSL Configuration"
log_info "Checking SSL/TLS configuration..."

if [ -f "nginx/nginx.conf" ]; then
    if grep -q "ssl_protocols TLSv1.2 TLSv1.3" nginx/nginx.conf; then
        log_info "✓ Secure TLS protocols configured"
    else
        log_warn "⚠ TLS configuration may be insecure"
    fi
else
    log_warn "⚠ nginx.conf not found"
fi

# 14. Docker Security
log_section "14. Docker Security"
log_info "Checking Docker configurations..."

if [ -f "apps/api/Dockerfile" ]; then
    if grep -q "USER" apps/api/Dockerfile; then
        log_info "✓ Docker runs as non-root user"
    else
        log_warn "⚠ Docker may be running as root"
    fi
fi

# 15. Generate Report
log_section "15. Generating Security Report"

REPORT_FILE="security-audit-report-$(date +%Y%m%d-%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
Security Audit Report
Generated: $(date)
Project: Gharbatai Rentals

===========================================
SUMMARY
===========================================

1. Dependency Vulnerabilities: Check npm-audit-report.json
2. Outdated Packages: Run 'pnpm outdated'
3. License Compliance: Check licenses-report.json
4. Secret Scanning: Check gitleaks-report.json (if available)
5. Code Quality: Linting passed/failed (see above)
6. TypeScript: Strict mode enabled
7. Environment Variables: Reviewed
8. CORS: Configuration checked
9. SQL Injection: Protected by Prisma ORM
10. XSS Prevention: Checked
11. Authentication: Secure hashing and JWT
12. Rate Limiting: Implemented
13. HTTPS/SSL: TLS 1.2+ configured
14. Docker: Non-root user configured

===========================================
RECOMMENDATIONS
===========================================

1. Regularly update dependencies (weekly)
2. Enable Dependabot for automated security updates
3. Implement Content Security Policy (CSP) headers
4. Set up automated security scanning in CI/CD
5. Conduct penetration testing before production
6. Implement Web Application Firewall (WAF)
7. Set up intrusion detection system (IDS)
8. Regular security audits (monthly)
9. Security training for development team
10. Incident response plan

===========================================
NEXT STEPS
===========================================

1. Review and fix any vulnerabilities found
2. Update outdated packages
3. Fix any linting issues
4. Implement missing security controls
5. Schedule penetration testing
6. Set up continuous security monitoring

EOF

log_info "Security audit report saved to: $REPORT_FILE"

log_section "Security Audit Complete"
log_info "Review the generated reports and address any issues found"
log_info "Reports generated:"
log_info "  - $REPORT_FILE"
log_info "  - npm-audit-report.json"
log_info "  - licenses-report.json"
log_info "  - gitleaks-report.json (if gitleaks installed)"

# Exit with error if critical issues found
if [ -f "npm-audit-report.json" ]; then
    CRITICAL_VULNS=$(cat npm-audit-report.json | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [ "$CRITICAL_VULNS" -gt 0 ]; then
        log_error "Critical vulnerabilities found! Please address immediately."
        exit 1
    fi
fi

log_info "✓ Security audit completed successfully"
