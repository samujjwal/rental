FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl
RUN npm install -g pnpm serve

# Avoid husky hooks in container builds.
ENV HUSKY=0

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rental-portal/shared-types build

# Set client API base at build time; default to reverse-proxied /api.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @rental-portal/web build

EXPOSE 3000

CMD ["serve", "-s", "apps/web/build/client", "-l", "3000"]
