# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install deps, compile React Router v7 static bundle
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl && \
    corepack enable pnpm

ENV HUSKY=0 NODE_ENV=development

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @rental-portal/shared-types build

# Set client API base at build time; default to reverse-proxied /api.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @rental-portal/web build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — static file server, non-root user, no source code
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl && \
    npm install -g serve@14

ENV NODE_ENV=production

# Copy only the compiled static bundle; no source files or devDependencies.
COPY --from=builder /app/apps/web/build/client apps/web/build/client/

# Run as the unprivileged built-in node user.
USER node

EXPOSE 3000

CMD ["serve", "-s", "apps/web/build/client", "-l", "3000"]
