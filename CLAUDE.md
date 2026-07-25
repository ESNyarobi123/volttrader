# Volt Trades — Engineering Rules & Architecture Guide

> **Core concept:** LEARN. INVEST. BUILD.
> **Positioning:** Learn Forex · Manage Capital · Explore Opportunities · Build the Future.
> This file is the source of truth for how we build Volt Trades. Read it before touching code.

---

## 1. Product principle

**Simple outside, powerful inside.** The customer sees three things: **Learn — Invest — Manage Money**.
The Admin absorbs the complexity (courses, users, payments, opportunities, KYC, ledgers, reports, audit logs).

Build Volt Trades as a **scalable ecosystem, not a single-page investment website**. Modules are connected
but independently manageable.

## 2. Architecture (non-negotiable)

- **Monorepo** (pnpm workspaces): `apps/web` (Next.js) + `apps/api` (NestJS/Fastify) + `packages/*` (shared TS).
- **Backend = Modular Monolith.** One deployable NestJS app; every domain is an isolated module. **No microservices.**
- **NestJS is the structure, Fastify is the HTTP engine** (`@nestjs/platform-fastify`).
- **PostgreSQL + Prisma.** Relational data with real DB transactions.
- **TypeScript everywhere.** Shared types/validation live in `packages/*` so web and api never drift.
- **Object storage (S3-compatible)** for all videos, PDFs, KYC docs, certificates, images. Never store binaries in Postgres or on the VPS disk.
- **Redis is deferred.** Do not add it until there is a real background job / queue / rate-limit need.

### Module map (`apps/api/src/modules/*`)

`auth · users · kyc · courses · enrollments · payments · wallet · ledger · opportunities · investments · withdrawals · projects · community · notifications · support · admin · audit`

## 3. Money rules (the most important rules in the codebase)

1. **The ledger is the source of truth.** A user's balance is **never** a stored mutable column.
   `balance = SUM(credits) - SUM(debits)` computed from `ledger_entries`.
2. **`ledger_entries` is append-only / immutable.** No `UPDATE`, no `DELETE`. Corrections are new compensating entries.
3. **Every money movement is atomic.** Payment confirmed → ledger entry + payment status + investment/enrollment
   must all happen inside **one `prisma.$transaction`**. Partial writes are forbidden.
4. **Store money as integer minor units** (e.g. cents/senti) with an explicit `currency`. Never floats for money.
5. **Payment status is confirmed server-side only.** The frontend never confirms a payment. Trust only a
   **verified** provider webhook/callback (signature-checked).
6. **Idempotency is mandatory** on all financial write endpoints (deposits, investments, withdrawals, webhooks).
   Use an idempotency key; a replayed request must not double-credit.
7. **Withdrawals require review.** Debit → request created → admin/approval → processing → completed/failed,
   each transition a ledger + audit event.

## 4. Compliance rules (legal — do not violate)

- **Never present guaranteed returns.** The "x5" model is a **configurable projection/target**, never hard-coded,
  never a guarantee. UI copy uses: **Projected Outcome / Target Performance / Historical Performance**.
- Every opportunity must carry a **risk disclosure**; the invest flow must force the user past Terms & Risk.
- Keep `FEATURE_REAL_MONEY_INVESTMENTS` behind a flag. Real-money launch is gated on legal/compliance review.
- Required legal pages must exist and be linked: `/terms`, `/privacy`, `/risk-disclosure`, refund policy.

## 5. Security rules

- Passwords hashed with bcrypt (rounds from env). Never log secrets, tokens, PII, card/bank numbers.
- All financial + admin routes: authenticated + authorized (RBAC) + validated + audit-logged.
- RBAC roles: `SUPER_ADMIN · FINANCE_ADMIN · CONTENT_MANAGER · SUPPORT_AGENT · COMPLIANCE_OFFICER` (+ `USER`).
- 2FA optional generally, **required for financial actions** (withdrawals, high-risk changes) once wired.
- Validate **every** input with Zod DTOs (shared from `@volt/validation`). Reject unknown fields.
- KYC gating: registration needs only name + email/phone + password. KYC is demanded **at the point** of
  investment / withdrawal, not at signup.

## 6. Coding conventions

- **NestJS module shape:** `x.module.ts`, `x.controller.ts`, `x.service.ts`, `dto/`, `entities/` (types).
  Controllers are thin (validate + delegate). Business logic lives in services. DB access via `PrismaService`.
- **Guards/decorators** live in `src/common`. Use `@Auth()`, `@Roles()`, `@CurrentUser()`, not ad-hoc checks.
- **Validation:** import Zod schemas from `@volt/validation`; never redefine a shape that already exists there.
- **Errors:** throw Nest `HttpException` subclasses; a global filter shapes the JSON envelope `{ error: {...} }`.
- **Responses:** consistent envelope `{ data, meta? }` for success. Money fields serialized as `{ amount, currency }`.
- **Frontend:** Next.js App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query for server state,
  React Hook Form + Zod for forms. Server Components by default; `"use client"` only when needed.
- **Route groups (web):** `(public)`, `(auth)`, `dashboard/*`, `admin/*`. `/admin` and `/dashboard` are role-guarded.
- **Naming:** files `kebab-case`, types `PascalCase`, vars/functions `camelCase`, DB tables `snake_case` (via `@@map`).
- **No secrets in code.** Everything through env + `ConfigService`.

## 7. Definition of Done (from the spec)

Every public CTA works · every protected route is authenticated · payments are verified server-side ·
balances come from ledger logic · admin can manage content · all critical flows are tested.

## 8. Delivery phases

- **Phase 1 — Foundation:** brand, public pages, auth, DB, admin base.
- **Phase 2 — Forex Academy:** catalogue, course detail, checkout, enrollment, progress.
- **Phase 3 — Wallet & Payments:** gateway abstraction, ledger, deposits, verification.
- **Phase 4 — Trading Floor:** opportunity management, investment records, portfolio.
- **Phase 5 — Projects:** project pages, roadmap, Volt Shop placeholder, Volt Society.
- **Phase 6 — Security & Launch:** testing, pen-test review, compliance review, backups, monitoring.

## 9. Local commands

```bash
pnpm install            # install workspace
pnpm docker:up          # postgres + redis + minio + mailhog
pnpm db:migrate         # apply Prisma migrations
pnpm db:seed            # seed roles, admin, demo courses/opportunities
pnpm dev                # run web + api together
pnpm dev:api            # api only  (http://localhost:4000/api)
pnpm dev:web            # web only  (http://localhost:3000)
```

## 10. Sub-agents

Specialised agents live in `.claude/agents/`. Use them for domain work:
`volt-backend`, `volt-frontend`, `volt-database`, `volt-payments`, `volt-security-compliance`, `volt-qa`,
`volt-academy` (quizzes, certificates, S3 lessons), `volt-launch` (Phase 6 / DoD proofs).

Gap order and prove-protocol: `.cursor/rules/volt-gap-roadmap.mdc` (one gap at a time).
