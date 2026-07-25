# Volt Trades

> **LEARN. INVEST. BUILD.** — Learn Forex, manage capital, explore investment opportunities, build the future.

A scalable financial-education ecosystem: Forex Academy, a configurable Trading Floor (investment
opportunities), a wallet backed by an immutable ledger, a gateway-agnostic payment system, KYC,
projects/community, and a full admin panel.

**Design principle:** _Simple outside, powerful inside._ Customers see **Learn — Invest — Manage Money**;
admins absorb the complexity.

---

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Frontend   | Next.js 14 (App Router) · TypeScript · Tailwind · TanStack Query · React Hook Form + Zod |
| Backend    | NestJS on **Fastify** · modular monolith                      |
| Database   | PostgreSQL + Prisma                                            |
| Storage    | S3-compatible object storage (MinIO in dev)                   |
| Cache/Jobs | Redis (deferred — added when background jobs appear)          |
| Infra      | Docker Compose (Postgres, Redis, MinIO, Mailhog)              |

## Monorepo layout

```
volt-trades/
├── apps/
│   ├── web/          # Next.js — public site, dashboard, admin
│   └── api/          # NestJS + Fastify — modular monolith
├── packages/
│   ├── config/       # shared enums, constants, brand, route groups
│   ├── validation/   # shared Zod schemas (API DTOs + web forms)
│   └── types/        # shared API contract types
├── docker-compose.yml
├── CLAUDE.md         # engineering rules & architecture (read this)
└── .claude/agents/   # domain sub-agents
```

## Getting started

```bash
# 1. Install (pnpm workspace)
pnpm install

# 2. Env — a dev .env is already at the repo root. For a fresh clone:
cp .env.example .env
#    All scripts load the ROOT .env automatically (via dotenv-cli), so the
#    apps do NOT need their own .env files.

# 3. Bring up infra (Postgres, Redis, MinIO, Mailhog)
pnpm docker:up

# 4. Generate the Prisma client, then create schema + harden ledger + seed
pnpm db:generate
pnpm db:setup          # = db:migrate  →  db:harden  →  db:seed

# 5. Run everything
pnpm dev               # web :3000  +  api :4000/api
```

`db:harden` installs DB-level triggers that make `ledger_entries` and `audit_logs`
append-only (no UPDATE/DELETE) — defense-in-depth for the money rules. Run it any
time after a fresh migrate; it is idempotent.

Seeded admin: **admin@volttrades.local / Admin@12345**

- Web: http://localhost:3000
- API: http://localhost:4000/api  (health: `/api/health`)
- MinIO console: http://localhost:9001
- Mailhog: http://localhost:8025

## The money model (read before touching finance code)

- Balance is **derived**: `SUM(credits) - SUM(debits)` from `ledger_entries`. There is no mutable balance column.
- `ledger_entries` is **append-only**. Corrections are new compensating entries.
- Money is stored as **integer minor units** (`BigInt`) + an explicit `currency`.
- Payments are confirmed **server-side only** via signature-verified webhooks; the frontend never confirms.
- Every money movement is one atomic `prisma.$transaction`, is **idempotent**, and is **audit-logged**.

## Compliance

The "x5" model is a **configurable projection/target — never a guarantee**. UI uses _Projected Outcome /
Target Performance / Historical Performance_. Real-money investing sits behind
`FEATURE_REAL_MONEY_INVESTMENTS` and must pass legal/compliance review before launch. See `CLAUDE.md`.

## Delivery phases

1. Foundation (brand, public pages, auth, DB, admin base)
2. Forex Academy (catalogue, checkout, enrollment, progress)
3. Wallet & Payments (gateway abstraction, ledger, deposits, verification)
4. Trading Floor (opportunities, investments, portfolio)
5. Projects (roadmap, Volt Shop placeholder, Volt Society)
6. Security & Launch (testing, pen-test, compliance review, backups, monitoring)
