# Build System Quick Reference

## 🚀 Daily Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm -F @rental-portal/api dev    # API only
pnpm -F @rental-portal/web dev    # Web only

# Before Committing
pnpm lint                   # Check code quality
pnpm typecheck              # Check types
pnpm format                 # Auto-format code
pnpm test                   # Run tests

# Before Creating PR
pnpm validate              # Full validation check
```

## 🔧 Common Tasks

```bash
# Install dependencies
pnpm install

# Add dependency to specific package
pnpm -F @rental-portal/web add <package>
pnpm -F @rental-portal/api add <package>

# Database
pnpm db:migrate            # Run migrations
pnpm db:studio             # Open Prisma Studio
pnpm db:seed               # Seed database

# Build
pnpm build                 # Build all packages
pnpm clean                 # Clean node_modules

# Testing
pnpm test                  # All tests
pnpm -F @rental-portal/web e2e    # E2E tests
```

## ⚠️ Important Notes

1. **Node Version:** Project requires Node 20

   ```bash
   nvm use 20
   ```

2. **Pre-commit Hooks:** Automatically run on `git commit`
   - Lints and formats staged files
   - Prevents bad commits

3. **Strict TypeScript:** All packages use strict mode
   - Catches bugs at compile time
   - No `any` types allowed (use proper types)

4. **Code Formatting:** Use Prettier (automatic via pre-commit)
   ```bash
   pnpm format        # Format all files
   pnpm format:check  # Check formatting
   ```

## 🏗️ Build System Architecture

```
Root (pnpm workspace)
├── apps/api (NestJS)
├── apps/web (React Router v7)
└── packages/database (Prisma)

Build Tool: Turbo (parallel builds + caching)
CI/CD: GitHub Actions
Type Safety: TypeScript (strict mode)
Code Quality: ESLint + Prettier
Git Hooks: Husky + lint-staged
```

## 📚 Documentation

- `BUILD_SYSTEM.md` - Comprehensive guide
- `BUILD_SYSTEM_GOLD_STANDARD_SUMMARY.md` - Implementation details
- `README.md` - Project overview

## 🐛 Troubleshooting

```bash
# Clean install
pnpm clean && pnpm install

# Clear Turbo cache
turbo clean && pnpm build

# Fix formatting
pnpm format

# Prisma issues
cd packages/database && npx prisma generate

# Type errors
pnpm typecheck
```

## ✅ Quality Checklist

Before pushing code:

- [ ] Code formatted (`pnpm format`)
- [ ] No lint errors (`pnpm lint`)
- [ ] No type errors (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)

Or just run: **`pnpm validate`** ✨
