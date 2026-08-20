#!/usr/bin/env bash
set -e

echo "🚀 Starting Social Video Scheduler local environment..."

# 1. Check Redis & Postgres
if ! command -v redis-cli &> /dev/null || ! redis-cli ping &> /dev/null; then
  echo "⚠️  Warning: Redis does not appear to be running on localhost:6379."
fi

if ! command -v pg_isready &> /dev/null || ! pg_isready -h localhost -p 5432 &> /dev/null; then
  echo "⚠️  Warning: PostgreSQL does not appear to be accepting connections on localhost:5432."
fi

# 2. Database migration & Prisma Client generation
echo "📦 Running Prisma migrations and generating client..."
npx prisma migrate deploy
npx prisma generate

# 3. Handle shutdown cleanly on Ctrl+C
cleanup() {
  echo ""
  echo "🛑 Stopping all background services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "🔥 Starting API (port 3001), Worker, and Admin UI (port 3000)..."

npm run api:dev &
API_PID=$!

npm run worker:dev &
WORKER_PID=$!

npm run admin:dev &
ADMIN_PID=$!

echo "✅ All services launched!"
echo "🌐 Admin UI: http://localhost:3000"
echo "⚙️  API Server: http://localhost:3001"
echo "Press Ctrl+C to stop all services."

wait
