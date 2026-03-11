FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl
RUN npm install -g pnpm

# Avoid husky hooks in container builds.
ENV HUSKY=0

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rental-portal/shared-types build
RUN pnpm --filter @rental-portal/database build
RUN pnpm --filter @rental-portal/database db:generate
RUN pnpm --filter @rental-portal/api build

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @rental-portal/database migrate:deploy && node apps/api/dist/main.js"]
