# Volt Trades Web — Next.js (pnpm monorepo, standalone output)
FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3001
ARG NEXT_PUBLIC_BRAND_NAME=Volt Trades
ARG NEXT_PUBLIC_ALLOW_MOCK_PAYMENTS=true
ARG NEXT_PUBLIC_S3_PUBLIC_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_ALLOW_MOCK_PAYMENTS=$NEXT_PUBLIC_ALLOW_MOCK_PAYMENTS \
    NEXT_PUBLIC_S3_PUBLIC_URL=$NEXT_PUBLIC_S3_PUBLIC_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @volt/config build \
  && pnpm --filter @volt/types build \
  && pnpm --filter @volt/validation build \
  && pnpm --filter @volt/web build

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Next standalone traces the monorepo layout under apps/web
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3001
CMD ["node", "apps/web/server.js"]
