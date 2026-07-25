#!/bin/sh
set -eu

echo "[volt-api] Waiting for database…"
# Prisma migrate deploy retries internally on some failures; give Postgres a moment.
sleep 2

echo "[volt-api] Applying migrations…"
pnpm --filter @volt/api exec prisma migrate deploy

echo "[volt-api] Hardening append-only tables…"
pnpm --filter @volt/api db:harden || true

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[volt-api] Seeding database…"
  pnpm --filter @volt/api db:seed || true
fi

echo "[volt-api] Starting NestJS…"
cd /app/apps/api
exec node dist/src/main.js
