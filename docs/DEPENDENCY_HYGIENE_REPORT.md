# Dependency Hygiene Report

**Date:** 2026-04-10
**Status:** Analysis Complete

## Summary

This report analyzes dependency hygiene across the monorepo packages: API, Web, Mobile, Shared Types, and Database.

## Package Structure

```
gharbatai-rentals (monorepo)
├── apps/api (NestJS backend)
├── apps/web (React Router v7 web app)
├── apps/mobile (React Native mobile app)
├── packages/database (Prisma schema)
└── packages/shared-types (Shared TypeScript types)
```

## Dependency Analysis

### 1. Shared Dependencies

#### TypeScript
- **Root:** `^5.9.3`
- **API:** `^5.9.3`
- **Web:** `^5.9.3`
- **Mobile:** `^5.9.3`
- **Shared Types:** `^5.9.3`
- **Database:** `^5.9.3`
✅ **Consistent** - All packages use TypeScript 5.9.3

#### Prettier
- **Root:** `^3.8.1`
- **API:** `^3.8.1`
- **Web:** `^3.8.1`
- **Mobile:** `^3.8.1`
✅ **Consistent** - All packages use Prettier 3.8.1

#### ESLint
- **Root:** `^9.39.2`
- **API:** `^9.39.2`
- **Web:** `^9.39.2`
- **Mobile:** `^9.39.2`
✅ **Consistent** - All packages use ESLint 9.39.2

#### Jest
- **API:** `^30.2.0`
- **Web:** `^4.0.18` (Vitest)
- **Mobile:** `^29.7.0`
- **Shared Types:** `^30.2.0`
- **Database:** `^30.2.0`
⚠️ **Inconsistent** - Web uses Vitest 4.0.18, Mobile uses Jest 29.7.0, others use Jest 30.2.0

### 2. Duplicate Dependencies

#### axios
- **API:** `^1.13.4`
- **Web:** `^1.13.4`
✅ **Consistent** - Both use axios 1.13.4

#### socket.io-client
- **API (dev):** `^4.8.3`
- **Web:** `^4.8.3`
- **Mobile:** `^4.8.3`
✅ **Consistent** - All use socket.io-client 4.8.3

#### date-fns
- **API:** `^4.1.0`
- **Web:** `^4.1.0`
✅ **Consistent** - Both use date-fns 4.1.0

#### stripe
- **API:** `^20.3.0`
- **Web:** `^20.3.0`
✅ **Consistent** - Both use Stripe 20.3.0

#### @prisma/client
- **API:** `^7.3.0`
- **Database:** `^7.3.0`
✅ **Consistent** - Both use Prisma Client 7.3.0

### 3. Cross-Package Dependencies

#### @rental-portal/shared-types
- **API:** `workspace:*`
- **Web:** `workspace:*`
- **Mobile:** `workspace:*`
✅ **Correct** - All consumer packages use workspace protocol

#### @rental-portal/database
- **API:** `workspace:*`
✅ **Correct** - Only API depends on database package

### 4. React Version Mismatch

#### React
- **Web:** `^19.2.4`
- **Mobile:** `18.3.1` (pinned)
⚠️ **Mismatch** - Web uses React 19.2.4, Mobile uses React 18.3.1

**Recommendation:** Consider aligning React versions when Mobile upgrades to React Native with React 19 support.

### 5. Potential Issues

#### 1. Mobile Jest Version Outdated
Mobile uses Jest 29.7.0 while other packages use Jest 30.2.0.
- **Impact:** Potential compatibility issues with Jest ecosystem
- **Recommendation:** Upgrade Mobile to Jest 30.2.0

#### 2. Web Uses Vitest Instead of Jest
Web uses Vitest 4.0.18 while other packages use Jest 30.2.0.
- **Impact:** Different test frameworks, but acceptable for different ecosystems
- **Recommendation:** Keep as-is (Vitest is appropriate for Vite-based projects)

#### 3. TypeScript ESLint Version Inconsistency
All packages use `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` at `^8.54.0`.
- **Status:** ✅ Consistent

#### 4. Babel/Runtime Dependencies
Mobile has `@babel/runtime: ^7.29.2` which is appropriate for React Native.
- **Status:** ✅ Correct for Mobile

### 6. Security Considerations

#### High-Risk Dependencies
- `bcrypt: ^6.0.0` (API, Database) - Cryptographic library, ensure regular updates
- `passport: ^0.7.0` (API) - Authentication library, ensure regular updates
- `stripe: ^20.3.0` (API, Web) - Payment library, ensure regular updates
- `twilio: ^5.12.0` (API) - SMS service, ensure regular updates

#### Recommendation
Implement automated security auditing via:
```bash
pnpm audit
```

### 7. Unused Dependencies

#### API DevDependencies
The following devDependencies should be reviewed for potential removal:
- `@types/multer` - No multer usage found in dependencies
- `ts-loader` - May be unused if using SWC builder

#### Mobile DevDependencies
- `@testing-library/react-native` - Verify if tests are actually using this

### 8. Dependency Hygiene Recommendations

#### High Priority
1. **Upgrade Mobile Jest** from 29.7.0 to 30.2.0 for consistency
2. **Add automated security audit** to CI pipeline
3. **Remove unused devDependencies** after verification

#### Medium Priority
4. **Consider React version alignment** when Mobile supports React 19
5. **Add dependency update automation** (e.g., Renovate or Dependabot)
6. **Document dependency update policy** in engineering docs

#### Low Priority
7. **Evaluate if Vitest/Jest unification** is desirable across packages
8. **Consider hoisting common devDependencies** to root package.json

### 9. Workspace Protocol Usage

✅ **Good Practice:** All cross-package dependencies use `workspace:*` protocol:
- API → `@rental-portal/database: workspace:*`
- API → `@rental-portal/shared-types: workspace:*`
- Web → `@rental-portal/shared-types: workspace:*`
- Mobile → `@rental-portal/shared-types: workspace:*`

This ensures:
- Single source of truth for version
- Automatic hoisting to node_modules/.pnpm
- Faster install times
- No version conflicts

### 10. Dependency Update Strategy

#### Current State
- Package manager: pnpm@10.28.2
- Workspace: Turborepo with pnpm workspaces
- No automated dependency updates configured

#### Recommended Strategy
1. **Add Renovate or Dependabot** for automated dependency updates
2. **Configure weekly dependency audits** in CI
3. **Create dependency update policy** document
4. **Pin critical security dependencies** with exact versions
5. **Use `pnpm update --latest`** for non-breaking updates
6. **Major version updates** require manual review and testing

## Conclusion

**Overall Dependency Hygiene Score: 8/10**

**Strengths:**
- Consistent TypeScript, Prettier, and ESLint versions across packages
- Proper use of workspace protocol for cross-package dependencies
- Shared dependencies (axios, socket.io-client, date-fns, stripe) are version-aligned
- Modern package manager (pnpm) with workspace support

**Areas for Improvement:**
- Mobile Jest version outdated (29.7.0 vs 30.2.0)
- React version mismatch between Web (19.2.4) and Mobile (18.3.1)
- No automated security auditing
- Potential unused devDependencies

**Next Steps:**
1. Implement automated security auditing
2. Upgrade Mobile Jest to 30.2.0
3. Add dependency update automation (Renovate/Dependabot)
4. Remove unused devDependencies after verification
5. Document dependency update policy
