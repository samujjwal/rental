#!/bin/bash

# Start dev environment completely detached from terminal
# This script is designed to run in the background without blocking

cd /Users/samujjwal/Development/rental

# Redirect all output to log files
exec 1>/tmp/dev-start-stdout.log
exec 2>/tmp/dev-start-stderr.log

# Start infrastructure
echo "[$(date)] Starting infrastructure..."
docker compose -f docker-compose.dev.yml up -d

# Wait briefly for Docker
sleep 10

echo "[$(date)] Waiting for PostgreSQL..."
max_attempts=30
attempt=0
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep rental-postgres | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    POSTGRES_CONTAINER="rental-postgres"
fi

while [ $attempt -lt $max_attempts ]; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U rental_user -d rental_portal > /dev/null 2>&1; then
        echo "[$(date)] PostgreSQL ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "[$(date)] Waiting for database... ($attempt/$max_attempts)"
    sleep 1
done

# Migrations
echo "[$(date)] Running migrations..."
cd packages/database
npx prisma migrate deploy || npx prisma migrate dev --name init
cd ../..

# Seeding
echo "[$(date)] Seeding database..."
npm run seed || echo "[$(date)] Seeding failed but continuing..."

# Start dev
echo "[$(date)] Starting Turbo dev..."
npm run dev

