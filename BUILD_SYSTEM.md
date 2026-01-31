# Build System Documentation

## Overview

This project uses an industry-standard, gold-tier build system with comprehensive tooling for development, testing, and deployment.

## Build Tools & Technologies

### Core Build System

- **Turbo** - High-performance monorepo build system with intelligent caching
- **pnpm** - Fast, disk-efficient package manager with workspace support
- **TypeScript** - Strict type checking across all packages
- **ESLint** - Code quality and consistency enforcement
- **Prettier** - Automated code formatting

### Quality Assurance

- **Husky** - Git hooks for pre-commit validation
- **lint-staged** - Run linters on staged files only
- **Vitest** - Fast unit testing framework
- **Playwright** - E2E testing for web applications
- **Jest** - Backend testing for NestJS API

### CI/CD

- **GitHub Actions** - Automated testing and deployment pipeline
- **Dependabot** - Automated dependency updates
- **Renovate** - Advanced dependency management (optional)

## Project Structure

```
rental/
├── apps/
│   ├── api/          # NestJS API (strict TypeScript)
│   └── web/          # React Router v7 web app (strict TypeScript)
├── packages/
│   └── database/     # Prisma schema and migrations (strict TypeScript)
├── .github/
│   ├── workflows/    # CI/CD pipelines
│   └── dependabot.yml
├── .husky/           # Git hooks
├── turbo.json        # Turbo configuration
├── tsconfig.json     # Root TypeScript config (project references)
├── .nvmrc            # Node version specification
├── .editorconfig     # Editor configuration
└── validate-build.sh # Comprehensive build validation
```

## Scripts

### Development

```bash
pnpm dev              # Start all apps in dev mode
pnpm -F @rental-portal/api dev    # Start API only
pnpm -F @rental-portal/web dev    # Start web only
```

### Building

```bash
pnpm build            # Build all packages
pnpm validate         # Run full build validation
```

### Code Quality

```bash
pnpm lint             # Run ESLint on all packages
pnpm typecheck        # Run TypeScript type checking
pnpm format           # Format code with Prettier
pnpm format:check     # Check code formatting
```

### Testing

```bash
pnpm test             # Run all tests
pnpm -F @rental-portal/api test       # API tests
pnpm -F @rental-portal/web test       # Web tests
pnpm -F @rental-portal/web e2e        # E2E tests
```

### Database

```bash
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database
```

## TypeScript Configuration

### Strict Mode Enabled ✅

All packages use strict TypeScript configuration:

- `strict: true`
- `strictNullChecks: true`
- `noImplicitAny: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `forceConsistentCasingInFileNames: true`

### Project References

The root `tsconfig.json` uses TypeScript project references for optimal build performance and type checking across packages.

## Pre-commit Hooks

Husky automatically runs on `git commit`:

1. **lint-staged** - Lints and formats only staged files
2. **ESLint** - Fixes auto-fixable issues
3. **Prettier** - Formats code

## CI/CD Pipeline

### On Pull Request & Push to main/develop:

1. **Lint & Format Check**
   - ESLint validation
   - Prettier format verification

2. **Type Check**
   - TypeScript compilation (no emit)
   - Ensures type safety across workspace

3. **API Tests**
   - Unit tests with coverage
   - Integration tests with PostgreSQL & Redis
   - Coverage reporting to Codecov

4. **Web Tests**
   - Unit tests with Vitest
   - Component tests

5. **Build**
   - Build all packages
   - Verify build artifacts

6. **Security Scan**
   - npm audit
   - Trivy vulnerability scanning

7. **E2E Tests** (PR only)
   - Full application testing with Playwright

## Build Validation

Run comprehensive validation:

```bash
./validate-build.sh
```

This script validates:

- ✅ Node.js version matches `.nvmrc`
- ✅ Dependencies install correctly
- ✅ Linting passes
- ✅ Code formatting is correct
- ✅ TypeScript compiles without errors
- ✅ Prisma client generates
- ✅ All packages build successfully
- ✅ All tests pass

## Dependency Management

### Automated Updates

- **Dependabot** - Weekly dependency updates (GitHub native)
- **Renovate** - Advanced dependency grouping and auto-merge

### Security

- Automated vulnerability scanning
- Security alerts for outdated dependencies
- Monthly lock file maintenance

## Editor Configuration

### .editorconfig

Ensures consistent coding style across all editors:

- UTF-8 encoding
- LF line endings
- 2-space indentation for JS/TS/JSON/YAML
- Trim trailing whitespace
- Insert final newline

### .nvmrc

Specifies Node.js version (20) for consistency across environments.

## Best Practices

1. **Always run `pnpm install`** after pulling changes
2. **Run `pnpm typecheck`** before committing
3. **Use `pnpm validate`** before creating PRs
4. **Keep dependencies up to date** - review Dependabot PRs weekly
5. **Write tests** for new features
6. **Use strict TypeScript** - avoid `any` types
7. **Follow commit conventions** for automatic changelog generation

## Troubleshooting

### Node version mismatch

```bash
nvm use  # Uses version from .nvmrc
```

### Dependency issues

```bash
pnpm clean    # Remove node_modules
pnpm install  # Reinstall
```

### Type errors

```bash
pnpm typecheck  # Check all packages
```

### Build cache issues

```bash
turbo clean     # Clear Turbo cache
pnpm build      # Rebuild
```

## Performance Optimizations

- **Turbo caching** - Avoid rebuilding unchanged packages
- **pnpm workspaces** - Shared dependencies, minimal disk usage
- **Incremental builds** - TypeScript incremental compilation
- **Parallel execution** - Run independent tasks simultaneously
- **Project references** - Faster TypeScript compilation

## Monitoring & Metrics

- Test coverage reported to Codecov
- Build times tracked in CI/CD
- Dependency vulnerability scanning
- Code quality metrics via ESLint

---

For more information, see:

- [Turbo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
