# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install all deps, generate Prisma client, compile TypeScript
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl && \
    corepack enable pnpm

# Suppress husky hooks; they are not relevant inside a container.
ENV HUSKY=0 NODE_ENV=development

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @rental-portal/shared-types build && \
    pnpm --filter @rental-portal/database build && \
    pnpm --filter @rental-portal/database db:generate && \
    pnpm --filter @rental-portal/api build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — lean runtime image, non-root user, no dev dependencies
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl && \
    corepack enable pnpm

ENV NODE_ENV=production HUSKY=0

# Copy only workspace manifests so pnpm can resolve the dependency graph,
# then install production-only dependencies (no devDependencies).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy compiled artefacts and the Prisma schema from the builder stage.
COPY --from=builder /app/apps/api/dist               apps/api/dist/
COPY --from=builder /app/packages/database/dist      packages/database/dist/
COPY --from=builder /app/packages/shared-types/dist  packages/shared-types/dist/
COPY --from=builder /app/packages/database/prisma    packages/database/prisma/

# Carry the generated Prisma client (lives inside node_modules at build time).
COPY --from=builder /app/node_modules/.prisma        node_modules/.prisma/

# Run as the unprivileged built-in node user; never run as root in production.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @rental-portal/database migrate:deploy && node apps/api/dist/main.js"]
